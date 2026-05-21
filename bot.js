const HaxballJS = require("haxball.js");

if (process.env.BIND_IP) {
  const bindIp = process.env.BIND_IP;
  try {
    const polyfill = require("node-datachannel/polyfill");
    const OriginalRTCPeerConnection = polyfill.RTCPeerConnection;
    polyfill.RTCPeerConnection = function PatchedRTCPeerConnection(config, ...args) {
      const patchedConfig = { ...config, bindAddress: bindIp };
      return new OriginalRTCPeerConnection(patchedConfig, ...args);
    };
    polyfill.RTCPeerConnection.prototype = OriginalRTCPeerConnection.prototype;
    console.log(`[WebRTC] bindAddress set to ${bindIp}`);
  } catch (e) {
    console.error('[WebRTC] bindAddress patch failed:', e.message);
  }
}

const config = require("./config");
const MAPS = require("./maps");
const TokenManager = require("./src/utils/TokenManager");

const TimeoutManager = require("./src/classes/TimeoutManager");
const RoomState = require("./src/classes/RoomState");
const PlayerActivityTracker = require("./src/classes/PlayerActivityTracker");
const LogManager = require("./src/classes/LogManager");

const TeamManager = require("./src/managers/TeamManager");
const CaptainManager = require("./src/managers/CaptainManager");
const RotationManager = require("./src/managers/RotationManager");
const GameFlowManager = require("./src/managers/GameFlowManager");
const StatsManager = require("./src/managers/StatsManager");
const BanManager = require("./src/managers/BanManager");
const AuthManager = require("./src/managers/AuthManager");
const RoomSyncManager = require("./src/managers/RoomSyncManager");
const VoteManager = require("./src/managers/VoteManager");

const EventHandlers = require("./src/handlers/EventHandlers");

const { DURATIONS, GameMode } = require("./src/utils/constants");

const CommandHandler = require("./src/commands/CommandHandler");
const PlayerCommands = require("./src/commands/PlayerCommands");

let roomManager = null;
let shutdownInProgress = false;

function requestShutdown(code = 0, reason = null) {
  const exitCode = Number.isFinite(Number(code)) ? Number(code) : 1;
  process.exitCode = exitCode;

  if (shutdownInProgress) return;
  shutdownInProgress = true;

  if (reason) {
    console.log(String(reason));
  }

  if (roomManager) {
    try { roomManager.timeouts.clearAll(); } catch (e) {}
    try { roomManager.roomSync?.destroy(); } catch (e) {}
    try { roomManager.playerCommands?.destroy(); } catch (e) {}
    try { roomManager.voteManager?.destroy(); } catch (e) {}
  }

  // I/O flush için kısa bekleme, ardından process'i kapat
  // Docker restart: unless-stopped politikası sayesinde container otomatik yeniden başlar
  setTimeout(() => {
    process.exit(exitCode);
  }, 500);
}

class HaxballRoomManager {
  constructor() {
    this.room = null;
    this.state = new RoomState();
    this.timeouts = new TimeoutManager();
    this.playerActivity = new PlayerActivityTracker();
    this.logger = new LogManager();

    this.teamManager = new TeamManager(this);
    this.captainManager = new CaptainManager(this);
    this.rotationManager = new RotationManager(this);
    this.gameFlow = new GameFlowManager(this);
    this.eventHandlers = new EventHandlers(this);

    this.commandHandler = new CommandHandler(this);
    this.playerCommands = new PlayerCommands(this);
    this.statsManager = new StatsManager();
    this.banManager = new BanManager();
    this.authManager = new AuthManager(this);
    this.roomSync = new RoomSyncManager(this);
    this.voteManager = new VoteManager(this);
    this.roomLink = null;
    this._roomReady = false;

    this.commandHandler.setPlayerCommands(this.playerCommands);

    this.playerAuthData = new Map();
    this.matchStats = new Map();
    this.matchGoalEvents = [];
    this.lastBallToucher = null;
    this.recentChat = [];
    this.recentGoals = [];

    this.roomSync.start();
  }

  _pushRecent(list, item, maxLen = 50) {
    if (!Array.isArray(list)) return;
    list.push(item);
    if (list.length > maxLen) list.splice(0, list.length - maxLen);
  }

  recordRecentChat(entry) {
    const now = Date.now();
    const e = { ts: now, ...entry };
    this._pushRecent(this.recentChat, e, 60);
    this.recentChat = this.recentChat.filter(x => now - (x.ts || 0) < 15 * 60 * 1000);
  }

  recordRecentGoal(entry) {
    const now = Date.now();
    const e = { ts: now, ...entry };
    this._pushRecent(this.recentGoals, e, 60);
    this.recentGoals = this.recentGoals.filter(x => now - (x.ts || 0) < 20 * 60 * 1000);
  }

  setPlayerAuthData(playerId, auth, conn) {
    this.playerAuthData.set(playerId, { auth, conn });
  }

  getPlayerAuthData(playerId) {
    return this.playerAuthData.get(playerId) || { auth: null, conn: null };
  }

  removePlayerAuthData(playerId) {
    this.playerAuthData.delete(playerId);
  }

  getRealPlayers() {
    if (!this.room) return [];
    return this.room.getPlayerList().filter(p => p.id !== 0);
  }

  getActivePlayers() {
    return this.getRealPlayers().filter(p => !this.playerActivity.isAFK(p.id));
  }

  getTeamPlayers(teamId) {
    return this.teamManager.getTeamPlayers(teamId);
  }

  getGameConfig() {
    const activePlayers = this.getActivePlayers();
    const totalPlayers = activePlayers.length;
    const targetMap = this.getMapForPlayerCount(totalPlayers);
    const playersPerTeam = this.getPlayersPerTeam(targetMap, totalPlayers);

    return { activePlayers, totalPlayers, targetMap, playersPerTeam };
  }

  getMapForPlayerCount(playerCount) {
    if (playerCount <= 1) return MAPS.TRAINING;
    if (playerCount <= 3) return MAPS.V2;
    if (playerCount <= 5) return MAPS.V2;
    return MAPS.V3;
  }

  getPlayersPerTeam(map, playerCount) {
    if (map === MAPS.TRAINING) return 1;
    if (map === MAPS.V2) return Math.min(2, Math.floor(playerCount / 2));
    if (map === MAPS.V3) return Math.min(3, Math.floor(playerCount / 2));
    if (playerCount <= 3) return 1;
    if (playerCount <= 5) return 2;
    return 3;
  }

  safeSetTeam(playerId, teamId) {
    try {
      const player = this.room.getPlayer(playerId);
      if (!player) return false;
      if (player.team === teamId) return true;

      if (this.state.mode !== GameMode.ROTATING && (teamId === 1 || teamId === 2) && this.state.currentMap && this.state.currentMap !== MAPS.TRAINING) {
        const { playersPerTeam } = this.getGameConfig();
        const currentTeamCount = this.getRealPlayers().filter(p => p.team === teamId && p.id !== playerId).length;
        if (currentTeamCount >= playersPerTeam) {
          console.log(`[safeSetTeam] Takım sınırı aşıldı! Team ${teamId}: ${currentTeamCount}/${playersPerTeam}, oyuncu eklenmedi`);
          return false;
        }
      }

      this.room.setPlayerTeam(playerId, teamId);
      return true;
    } catch (error) {
      return false;
    }
  }

  safeKickPlayer(playerId, reason, ban = false) {
    try {
      this.room.kickPlayer(playerId, reason, ban);
      return true;
    } catch (error) {
      return false;
    }
  }

  safeStartGame() {
    try {
      if (this.state.isCaptainMode()) {
        console.log(`[safeStartGame] Kaptan modu aktif, oyun başlatılmadı`);
        return false;
      }

      if (this.state.gameInProgress || this.state.pendingGameStart) {
        console.log(`[safeStartGame] Engellendi - gameInProgress: ${this.state.gameInProgress}, pendingGameStart: ${this.state.pendingGameStart}`);
        return false;
      }

      if (this.state.pendingGameStop) {
        console.log(`[safeStartGame] Oyun durduruluyor, başlatma bekleniyor`);
        return false;
      }

      const redCount = this.getRealPlayers().filter(p => p.team === 1).length;
      const blueCount = this.getRealPlayers().filter(p => p.team === 2).length;
      const isTraining = this.state.currentMap === MAPS.TRAINING;

      if (!isTraining && (redCount === 0 || blueCount === 0)) {
        console.log(`[safeStartGame] Takımlar boş! Red: ${redCount}, Blue: ${blueCount}`);
        return false;
      }

      if (isTraining && redCount === 0) {
        console.log(`[safeStartGame] Training mode ama Red takımı boş`);
        return false;
      }

      this.state.requestGameStart();
      this.room.startGame();

      this.timeouts.set('gameStartSafety', () => {
        if (this.state.pendingGameStart) {
          console.log('[safeStartGame] onGameStart gelmedi, pendingGameStart sıfırlanıyor');
          this.state.pendingGameStart = false;
        }
      }, this.state.pendingOperationTimeoutMs);

      return true;
    } catch (error) {
      console.error('[safeStartGame] Hata:', error.message);
      this.state.pendingGameStart = false;
      return false;
    }
  }

  safeStopGame() {
    try {
      if (this.state.pendingGameStop) {
        console.log(`[safeStopGame] Oyun zaten durduruluyor`);
        return false;
      }

      this.state.requestGameStop();
      this.room.stopGame();
      return true;
    } catch (error) {
      console.error('[safeStopGame] Hata:', error.message);
      this.state.pendingGameStop = false;
      return false;
    }
  }

  balanceTeams(preserveTeams = true) {
    return this.teamManager.balanceTeams(preserveTeams);
  }

  shuffleTeams() {
    return this.teamManager.shuffleTeams();
  }

  startCaptainSelection(captain, specPlayers, neededCount) {
    return this.captainManager.startCaptainSelection(captain, specPlayers, neededCount);
  }

  endCaptainSelection(shuffle = false) {
    return this.captainManager.endCaptainSelection(shuffle);
  }

  handleCaptainChoice(player, message) {
    return this.captainManager.handleCaptainChoice(player, message);
  }

  handleRotation(scores) {
    return this.rotationManager.handleRotation(scores);
  }

  initMatchStats() {
    this.matchStats.clear();
    this.matchGoalEvents = [];
    this.lastBallToucher = null;
  }

  recordGoal(scorerAuth, assistAuth, isOwnGoal) {
    if (!scorerAuth) return;

    if (!this.matchStats.has(scorerAuth)) {
      this.matchStats.set(scorerAuth, { goals: 0, assists: 0, ownGoals: 0 });
    }
    const scorerStats = this.matchStats.get(scorerAuth);

    if (isOwnGoal) {
      scorerStats.ownGoals++;
    } else {
      scorerStats.goals++;
    }

    if (assistAuth && assistAuth !== scorerAuth && !isOwnGoal) {
      if (!this.matchStats.has(assistAuth)) {
        this.matchStats.set(assistAuth, { goals: 0, assists: 0, ownGoals: 0 });
      }
      this.matchStats.get(assistAuth).assists++;
    }
  }

  async refreshTokenAndRestart() {
    if (!config.twoCaptchaApiKey) {
      console.error("2Captcha API key bulunamadı!");
      requestShutdown(1);
      return false;
    }

    const tokenManager = new TokenManager(config.twoCaptchaApiKey);

    try {
      await tokenManager.getTokenWithRetry(3);
      console.log("Token yenilendi, yeniden başlatılıyor...");
      requestShutdown(0);
      return true;
    } catch (error) {
      console.error("Token yenileme başarısız:", error.message);
      requestShutdown(1);
      return false;
    }
  }

  isValidToken(token) {
    if (!token || typeof token !== 'string') return false;
    const trimmed = token.trim();
    if (trimmed.length < 30) return false;
    return true;
  }

  async getValidToken() {
    let token = config.token;

    if (this.isValidToken(token)) {
      return token.trim();
    }

    console.log("Token geçersiz veya bulunamadı, yeni token alınıyor...");

    if (config.autoRefreshToken && config.twoCaptchaApiKey) {
      const tokenManager = new TokenManager(config.twoCaptchaApiKey);
      token = await tokenManager.getTokenWithRetry(3);
      return token;
    }

    throw new Error("Token bulunamadı ve otomatik yenileme kapalı!");
  }

  async init() {
    try {
      const token = await this.getValidToken();

      const finalRoomConfig = {
        ...config.roomConfig,
        token: token
      };

      console.log("Oda oluşturuluyor...");

      const HBInit = await HaxballJS;
      this.room = await HBInit(finalRoomConfig);

      this.room.onRoomLink = (url) => {
        this.roomLink = url;
        this.roomSync?.updateRoomStatus?.();
        if (!this._roomReady) {
          this._roomReady = true;
          console.log("Oda Linki:", url);
          console.log("Bot hazır!");
        }
      };

      this.gameFlow.changeMap(MAPS.TRAINING);
      this.room.setTeamsLock(true);

      this.room.onPlayerJoin = this.eventHandlers.onPlayerJoin.bind(this.eventHandlers);
      this.room.onPlayerLeave = this.eventHandlers.onPlayerLeave.bind(this.eventHandlers);
      this.room.onPlayerTeamChange = this.eventHandlers.onPlayerTeamChange.bind(this.eventHandlers);
      this.room.onGameStart = this.eventHandlers.onGameStart.bind(this.eventHandlers);
      this.room.onGameStop = this.eventHandlers.onGameStop.bind(this.eventHandlers);
      this.room.onTeamVictory = this.eventHandlers.onTeamVictory.bind(this.eventHandlers);
      this.room.onPlayerChat = this.eventHandlers.onPlayerChat.bind(this.eventHandlers);
      this.room.onPlayerActivity = this.eventHandlers.onPlayerActivity.bind(this.eventHandlers);
      this.room.onGameTick = this.eventHandlers.onGameTick.bind(this.eventHandlers);
      this.room.onPlayerBallKick = this.eventHandlers.onPlayerBallKick.bind(this.eventHandlers);
      this.room.onTeamGoal = this.eventHandlers.onTeamGoal.bind(this.eventHandlers);
      this.room.onPlayerAdminChange = this.eventHandlers.onPlayerAdminChange.bind(this.eventHandlers);
      this.room.onPlayerKicked = this.eventHandlers.onPlayerKicked.bind(this.eventHandlers);

      this.timeouts.setInterval('inactivityCheck', () => this.gameFlow.checkInactivity(), DURATIONS.INACTIVITY_CHECK_INTERVAL);
      this.timeouts.setInterval('teamBalanceCheck', () => this.gameFlow.checkTeamBalance(), 2000);
      this.timeouts.setInterval('activityCleanup', () => this.playerActivity.cleanup(), DURATIONS.ACTIVITY_CLEANUP);
      this.timeouts.setInterval('watchdog', () => this.gameFlow.watchdog(), 3000);

    } catch (error) {
      console.error("Hata:", error);
      requestShutdown(1);
      return;
    }
  }
}

async function startBot() {
  const db = require('./src/database/Database');
  await db.connect();
  roomManager = new HaxballRoomManager();
  await roomManager.init();
}

async function handleTokenError() {
  if (config.autoRefreshToken && config.twoCaptchaApiKey) {
    if (roomManager) {
      await roomManager.refreshTokenAndRestart();
    } else {
      const tokenManager = new TokenManager(config.twoCaptchaApiKey);
      await tokenManager.getTokenWithRetry(3);
      await startBot();
    }
    return true;
  }
  return false;
}

function isTokenError(msg) {
  const lowerMsg = msg.toLowerCase();
  return lowerMsg.includes('invalid token') || lowerMsg.includes('expired') || lowerMsg.includes('token');
}

function isDataChannelError(msg) {
  return msg.includes('DataChannel is closed') || msg.includes('libdatachannel error');
}

const originalStderrWrite = process.stderr.write.bind(process.stderr);
process.stderr.write = function(chunk, encoding, callback) {
  const str = typeof chunk === 'string' ? chunk : chunk.toString();
  if (isDataChannelError(str)) {
    if (typeof callback === 'function') callback();
    return true;
  }
  return originalStderrWrite(chunk, encoding, callback);
};

const originalConsoleError = console.error;
console.error = function(...args) {
  const msg = args.map(a => {
    if (a instanceof Error) return a.message + ' ' + (a.stack || '');
    return String(a);
  }).join(' ');
  if (isDataChannelError(msg)) return;
  originalConsoleError.apply(console, args);
};

const originalConsoleLog = console.log;
let tokenRecoveryStartedFromLog = false;

function hasInvalidTokenMessage(msg) {
  return /invalid token/i.test(String(msg || ''));
}

function triggerTokenRecoveryFromLog(originalMsg) {
  if (tokenRecoveryStartedFromLog) return;
  tokenRecoveryStartedFromLog = true;

  originalConsoleLog.call(console, "Token geçersiz, yenileme başlatılıyor...");
  handleTokenError()
    .then(handled => {
      if (!handled) {
        originalConsoleError.call(console, `Token yenilenemedi! (Kaynak log: ${String(originalMsg || '').slice(0, 200)})`);
        requestShutdown(1);
        return;
      }
      tokenRecoveryStartedFromLog = false;
    })
    .catch((err) => {
      tokenRecoveryStartedFromLog = false;
      originalConsoleError.call(console, 'Token yenileme akışında beklenmeyen hata:', err?.message || err);
      requestShutdown(1);
    });
}

console.log = function(...args) {
  const msg = args.map(a => a?.message || String(a)).join(' ');
  originalConsoleLog.apply(console, args);

  if (hasInvalidTokenMessage(msg)) {
    triggerTokenRecoveryFromLog(msg);
  }
};

process.on("uncaughtException", async (err) => {
  const errorMsg = err.message || String(err);

  if (isDataChannelError(errorMsg)) {
    return;
  }

  originalConsoleError("Hata:", err);
  if (isTokenError(errorMsg)) {
    console.log("Token hatası yakalandı, yenileme deneniyor...");
    const handled = await handleTokenError();
    if (handled) return;
  }
  requestShutdown(1);
});

process.on("unhandledRejection", async (reason) => {
  const errorMsg = reason?.message || String(reason);

  if (isDataChannelError(errorMsg)) {
    return;
  }

  originalConsoleError("Hata:", reason);
  if (isTokenError(errorMsg)) {
    console.log("Token hatası yakalandı (rejection), yenileme deneniyor...");
    const handled = await handleTokenError();
    if (handled) return;
  }
  requestShutdown(1);
});

function gracefulShutdown(signal) {
  requestShutdown(0, `${signal} alındı, kapatılıyor...`);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

startBot();
