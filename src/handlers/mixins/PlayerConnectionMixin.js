const { TIMING, Team, GameMode } = require('../../utils/constants');
const MAPS = require('../../../maps');
const config = require('../../../config');
const db = require('../../database/Database');

const JOIN_TRACKER_CLEANUP_INTERVAL = 300000;
const JOIN_TRACKER_MAX_AGE = 600000;

class JoinTracker {
  constructor() {
    this.connections = new Map();
    this.cleanupInterval = setInterval(() => this.cleanup(), JOIN_TRACKER_CLEANUP_INTERVAL);
  }

  check(conn, limit) {
    const now = Date.now();
    if (!this.connections.has(conn)) {
      this.connections.set(conn, { timestamps: [], banned: false, lastAccess: now });
    }

    const data = this.connections.get(conn);
    data.lastAccess = now;
    data.timestamps = data.timestamps.filter(ts => now - ts < limit.windowMs);

    if (data.timestamps.length >= limit.maxJoins) {
      const oldestTs = data.timestamps[0];
      const remainingTime = Math.ceil((limit.windowMs - (now - oldestTs)) / 1000);
      return { allowed: false, remainingTime };
    }

    data.timestamps.push(now);
    return { allowed: true, remainingTime: 0 };
  }

  cleanup() {
    const now = Date.now();
    for (const [conn, data] of this.connections.entries()) {
      if (now - data.lastAccess > JOIN_TRACKER_MAX_AGE) {
        this.connections.delete(conn);
      }
    }
  }

  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.connections.clear();
  }
}

const joinTracker = new JoinTracker();

module.exports = {
  checkJoinSpam(conn) {
    const limit = config.joinLimit || { windowMs: 60000, maxJoins: 3 };
    return joinTracker.check(conn, limit);
  },

  formatRemainingSeconds(totalSeconds) {
    const s = Number(totalSeconds) || 0;
    if (s <= 0) return '0sn';
    const m = Math.floor(s / 60);
    const r = s % 60;
    if (m <= 0) return `${r}sn`;
    return `${m}dk ${r}sn`;
  },

  validateNick(name) {
    const rules = config.nickRules || { maxLength: 20 };

    if (!name || name.trim().length === 0) {
      return { valid: false, reason: "Nick boş olamaz!" };
    }

    const trimmedName = name.trim();

    if (trimmedName.length > rules.maxLength) {
      return { valid: false, reason: `Nick en fazla ${rules.maxLength} karakter olmalı!` };
    }

    const dangerousChars = /[\u202E\u202D\u202C\u202B\u202A\u200F\u200E\u2066\u2067\u2068\u2069\u061C\uFEFF\u00AD]/;
    if (dangerousChars.test(name)) {
      return { valid: false, reason: "Geçersiz karakter! Normal nick kullan." };
    }

    const invisiblePattern = /^[\s\u200B\u200C\u200D\uFEFF]*$/;
    if (invisiblePattern.test(trimmedName)) {
      return { valid: false, reason: "Nick görünür karakter içermeli!" };
    }

    return { valid: true, reason: null };
  },

  async processNextEvent() {
    if (this.eventQueue.length === 0) return;

    const { type, data, resolve } = this.eventQueue[0];

    if (type === 'join' && !this.processingJoin && !this.processingLeave) {
      this.processingJoin = true;
      this.eventQueue.shift();
      await this._handleJoin(data);
      this.processingJoin = false;
      resolve();
      await this.processNextEvent();
    } else if (type === 'leave' && !this.processingJoin && !this.processingLeave) {
      this.processingLeave = true;
      this.eventQueue.shift();
      await this._handleLeave(data);
      this.processingLeave = false;
      resolve();
      await this.processNextEvent();
    }
  },

  queueEvent(type, data) {
    return new Promise(resolve => {
      this.eventQueue.push({ type, data, resolve });
      if (!this.processingJoin && !this.processingLeave) {
        this.processNextEvent();
      }
    });
  },

  onPlayerJoin(player) {
    this.queueEvent('join', player);
  },

  async _handleJoin(player) {
    if (!player || !player.id) return;

    if (!player.auth) {
      this.rm.safeKickPlayer(player.id, "Haxball hesabına giriş yapman gerekiyor!", false);
      return;
    }

    const banInfo = await this.rm.banManager.isBanned(player.name, player.auth, player.conn, config.roomType);
    if (banInfo) {
      const kickMsg = banInfo.expires_at
        ? `Bu odaya giriş yasağın var (${new Date(banInfo.expires_at).toISOString().slice(0, 10)} tarihine kadar): ${banInfo.reason}`
        : `Karalistedesin: ${banInfo.reason}`;
      this.rm.safeKickPlayer(player.id, kickMsg, false);
      return;
    }

    const user = await db.get('SELECT id, allowed_room, nickname, is_admin FROM users WHERE auth = ? AND LOWER(nickname) = LOWER(?)', [player.auth, player.name]);
    const isVip = user?.allowed_room === 'vip';
    const isAdmin = user?.is_admin === 1;

    const rankRestrictionEnabled = (await db.getSetting('rank_restriction', 'true')) === 'true';
    if (rankRestrictionEnabled && !isAdmin && config.roomType && config.roomTypes[config.roomType]) {
      const roomInfo = config.roomTypes[config.roomType];
      const dbMin = await db.getSetting(`room_min_points_${config.roomType}`, null);
      const dbMax = await db.getSetting(`room_max_points_${config.roomType}`, null);
      const minPoints = dbMin !== null ? Number(dbMin) : roomInfo.minPoints;
      const maxPoints = dbMax !== null ? (dbMax === 'Infinity' ? Infinity : Number(dbMax)) : roomInfo.maxPoints;
      const roomLevels = { agir_acemi_1: 1, agir_acemi_2: 1, orta: 3, orta_2: 3, hp: 4, hp_2: 4 };
      const currentRoomLevel = roomLevels[config.roomType] || 1;
      if (user) {
        if (user.allowed_room === 'vip' || (user.allowed_room && roomLevels[user.allowed_room] >= currentRoomLevel)) {
        } else {
          const stats = await db.get('SELECT points, peak_points FROM stats WHERE user_id = ?', [user.id]);
          const userPoints = stats?.points || 0;
          const peakPoints = stats?.peak_points || 0;
          const accessPoints = Math.max(userPoints, peakPoints);

          if (accessPoints < minPoints || accessPoints > maxPoints) {
            this.rm.safeKickPlayer(
              player.id,
              `Bu oda ${minPoints}-${maxPoints === Infinity ? '∞' : maxPoints} puan aralığı için! Mevcut: ${userPoints} | En yüksek: ${peakPoints}`,
              false
            );
            return;
          }
        }
      } else {
        const allowedForNew = ['agir_acemi_1', 'agir_acemi_2'];
        if (!allowedForNew.includes(config.roomType)) {
          this.rm.safeKickPlayer(
            player.id,
            `Bu odaya girmek için kayıt olman ve puan kazanman gerekiyor! Acemi odalarından başla.`,
            false
          );
          return;
        }
      }
    }

    const existingPlayers = this.rm.getRealPlayers();
    const duplicateAuth = existingPlayers.find(p => p.id !== player.id && p.auth && p.auth === player.auth);
    if (duplicateAuth) {
      this.rm.safeKickPlayer(player.id, "Ayni hesap zaten odada!", false);
      return;
    }

    const otherPlayers = existingPlayers.filter(p => p.id !== player.id);
    const otherCount = otherPlayers.length;
    const isOwner = config.ownerNickname && player.name.toLowerCase() === config.ownerNickname.toLowerCase();
    const maxNormal = 10;
    const maxWithVip = 11;
    const maxWithAdmin = 12;

    if (isOwner) {
    } else if (isAdmin) {
      if (otherCount >= maxWithAdmin) {
        this.rm.safeKickPlayer(player.id, "Oda dolu!", false);
        return;
      }
      const adminInRoom = otherPlayers.some(p => {
        const lu = this.rm.authManager?.getLoggedInUser(p.id);
        return lu?.isAdmin;
      });
      if (otherCount >= maxWithVip && adminInRoom) {
        this.rm.safeKickPlayer(player.id, "Oda dolu! (Admin slotu dolu)", false);
        return;
      }
    } else if (isVip) {
      if (otherCount >= maxWithVip) {
        this.rm.safeKickPlayer(player.id, "Oda dolu! (VIP slotu dolu)", false);
        return;
      }
      const vipInRoom = otherPlayers.some(p => {
        const lu = this.rm.authManager?.getLoggedInUser(p.id);
        return lu?.isVip && !lu?.isAdmin;
      });
      if (otherCount >= maxNormal && vipInRoom) {
        this.rm.safeKickPlayer(player.id, "Oda dolu! (VIP slotu dolu)", false);
        return;
      }
    } else {
      if (otherCount >= maxNormal) {
        this.rm.safeKickPlayer(player.id, "Oda dolu!", false);
        return;
      }
    }

    await this.rm.banManager.recordPlayer(player.name, player.auth, player.conn);

    const joinCheck = this.checkJoinSpam(player.conn);
    if (!joinCheck.allowed) {
      this.rm.safeKickPlayer(player.id, `Çok hızlı giriş! ${joinCheck.remainingTime}sn bekle.`, false);
      return;
    }

    this.playerJoinTimes.set(player.id, Date.now());

    const nickCheck = this.validateNick(player.name);
    if (!nickCheck.valid) {
      this.rm.safeKickPlayer(player.id, nickCheck.reason, false);
      return;
    }

    if (!isAdmin && this.profanityFilter?.enabled && this.profanityFilter.check(player.name)) {
      this.rm.safeKickPlayer(player.id, 'Uygunsuz nick! Başka nick ile gel.', false);
      return;
    }

    const duplicateNick = existingPlayers.find(p =>
      p.id !== player.id && p.name.toLowerCase() === player.name.toLowerCase()
    );
    if (duplicateNick) {
      this.rm.safeKickPlayer(player.id, "Bu nick zaten kullanılıyor! Başka nick seç.", false);
      return;
    }

    this.rm.setPlayerAuthData(player.id, player.auth, player.conn);
    this.rm.playerActivity.update(player.id);
    this.rm.safeSetTeam(player.id, Team.SPECTATORS);

    if (this.rm.authManager) {
      const loginResult = await this.rm.authManager.autoLogin(player.id, player.auth, player.conn, player.name);
      if (loginResult.success) {
        const loggedUser = loginResult.user;

        if (loggedUser.is_admin === 1) {
          this.rm.room.setPlayerAdmin(player.id, true);
        }

        if (loggedUser.allowed_room === 'vip' || loggedUser.is_admin === 1) {
          await this.rm.playerCommands?._loadAnimatedAvatar(player.id, player.auth);
        }

        if (loggedUser.allowed_room === 'vip') {
          this.rm.room.sendAnnouncement(
            `⭐ ${loggedUser.nickname} aramıza katıldı!`,
            null, 0xFFD700, 'bold', 1
          );
          this.rm.room.sendAnnouncement(
            `Özelliklerini yönetmek için: !vipyardım`,
            player.id, 0xFFD700, 'normal', 0
          );
        } else {
          this.rm.room.sendAnnouncement(
            `Hoş geldin ${loggedUser.nickname}!`,
            player.id, 0x00FF00, 'normal', 1
          );
        }
      } else {
        if (await this.rm.authManager.isNicknameTaken(player.name)) {
          this.rm.room.sendAnnouncement(
            `Bu nick ile hesabın var! Giriş yap: !giris <şifre>`,
            player.id, 0xFFFF00, 'normal', 1
          );
        } else {
          this.rm.room.sendAnnouncement(
            'Hoş geldin! Kayıt ol: !kayit <şifre>',
            player.id, 0x00FF00, 'normal', 1
          );
        }
      }
    } else {
      this.rm.room.sendAnnouncement('Hoş geldin!', player.id, 0x00FF00, 'normal', 1);
    }

    this.rm.room.sendAnnouncement(
      '!yardım | !kurallar | !tg',
      player.id, 0xAAAAAA, 'normal', 0
    );

    const joinAnnouncement = await this.rm.playerCommands?.getJoinAnnouncement();
    if (joinAnnouncement) {
      this.rm.room.sendAnnouncement(`${joinAnnouncement}`, player.id, 0xFFFF00, 'bold', 1);
    }

    this.rm.logger.playerJoin(player, player.auth);

    if (this.rm.state.adminStopped) {
      this.rm.state.adminStopped = false;
    }

    if (this.rm.state.isCaptainMode()) {
      this.rm.captainManager.showSelectionList();
      return;
    }

    if (this.rm.state.mode === GameMode.ROTATING) {
      return;
    }

    if (this.rm.state.gameInProgress && this.rm.state.currentMap !== MAPS.TRAINING) {
      const { totalPlayers, targetMap, playersPerTeam } = this.rm.getGameConfig();
      const currentPlayersPerTeam = this.rm.getPlayersPerTeam(this.rm.state.currentMap, totalPlayers);

      if (targetMap !== this.rm.state.currentMap && playersPerTeam > currentPlayersPerTeam) {
        console.log(`[MAP_UPGRADE] Join triggered: ${playersPerTeam}v${playersPerTeam}`);
        this.rm.state.isManualStop = true;
        this.rm.safeStopGame();
        this.rm.state.gameInProgress = false;
        this.rm.gameFlow.scheduleBalance();
        return;
      }

      this.rm.room.sendAnnouncement(
        `Maç devam ediyor, sırada bekliyorsun. Maç bitince dahil olacaksın!`,
        player.id, 0xFFFF00, 'normal', 1
      );
      return;
    }

    this.rm.gameFlow.scheduleBalance();
  },

  onPlayerLeave(player) {
    this.queueEvent('leave', player);
  },

  async _handleLeave(player) {
    if (!player) return;

    const wasPlaying = player.team === Team.RED || player.team === Team.BLUE;

    if (wasPlaying && this.rm.state.gameInProgress) {
      const currentMap = this.rm.state.currentMap;
      if (currentMap === MAPS.V2 || currentMap === MAPS.V3) {
        const allPlaying = this.rm.getRealPlayers().filter(p => p.id !== player.id);
        const redCount = allPlaying.filter(p => p.team === Team.RED).length + (player.team === Team.RED ? 0 : 0);
        const blueCount = allPlaying.filter(p => p.team === Team.BLUE).length;
        const teamCount = player.team === Team.RED
          ? this.rm.getRealPlayers().filter(p => p.team === Team.RED).length
          : this.rm.getRealPlayers().filter(p => p.team === Team.BLUE).length;
        if (teamCount >= 2) {
          const auth = this.rm.getPlayerAuthData(player.id)?.auth;
          if (auth) {
            const loggedIn = this.rm.authManager?.getLoggedInUser(player.id);
            const userId = loggedIn?.userId;
            if (userId) {
              await this.rm.statsManager.recordMatch(userId, false);
              this.rm.room.sendAnnouncement(
                `${player.name} maçı terk etti, mağlubiyet yazıldı.`,
                null, 0xFF6600, 'bold', 1
              );
            }
          }
        }
      }
    }

    const joinTime = this.playerJoinTimes.get(player.id);
    const playTime = joinTime ? Date.now() - joinTime : 60000;
    this.playerJoinTimes.delete(player.id);

    this.rm.logger.playerLeave(player);

    if (this.rm.commandHandler) {
      this.rm.commandHandler.onPlayerLeave(player.id);
    }

    this.rm.voteManager?.onPlayerLeave(player.id);

    this.rm.playerActivity.remove(player.id);
    this.rm.removePlayerAuthData(player.id);
    this.messageHistory.delete(player.id);
    this.chatTimestamps.delete(player.id);
    this.chatWarnings.delete(player.id);
    this.rm.gameFlow?.removePlayerPosition(player.id);
    this.rm.playerCommands?.clearPlayerMutes(player.id);
    this.rm.authManager?.logout(player.id);

    if (this.rm.state.isCaptainMode()) {
      const captain = this.rm.state.getCurrentCaptain();
      if (captain && captain.id === player.id) {
        this.rm.state.endCaptainMode();
        this.rm.timeouts.clear('captain');
        this.rm.timeouts.clear('captainWarning');
        this.rm.captainManager.isMidGameReplacement = false;
        this.rm.captainManager.midGameTargetTeam = null;
        this.rm.captainManager.isDualSelection = false;
        this.rm.captainManager.dualSelectionState = null;
        console.log(`[CAPTAIN] Kaptan ${player.name} ayrıldı, rebalance`);
        this.rm.gameFlow.scheduleBalance();
        return;
      } else {
        const { totalPlayers, playersPerTeam } = this.rm.getGameConfig();
        const currentPlayersPerTeam = this.rm.getPlayersPerTeam(this.rm.state.currentMap, totalPlayers);

        if (playersPerTeam < currentPlayersPerTeam) {
          this.rm.state.endCaptainMode();
          this.rm.timeouts.clear('captain');
          this.rm.timeouts.clear('captainWarning');
          this.rm.captainManager.isMidGameReplacement = false;
          this.rm.captainManager.midGameTargetTeam = null;
          this.rm.captainManager.isDualSelection = false;
          this.rm.captainManager.dualSelectionState = null;
          console.log(`[CAPTAIN] Oyuncu yetersiz (${playersPerTeam} < ${currentPlayersPerTeam}), rebalance`);
          this.rm.gameFlow.scheduleBalance();
          return;
        }
        this.rm.captainManager.showSelectionList();
        return;
      }
    }

    if (this.rm.state.mode === GameMode.ROTATING) {
      return;
    }

    this.rm.timeouts.set(`playerLeaveProcess_${player.id}`, () => {
      const { activePlayers, totalPlayers, targetMap } = this.rm.getGameConfig();
      const specPlayers = activePlayers.filter(p => p.team === Team.SPECTATORS && !this.rm.playerActivity.isAFK(p.id));
      const redPlayers = activePlayers.filter(p => p.team === Team.RED);
      const bluePlayers = activePlayers.filter(p => p.team === Team.BLUE);

      if (totalPlayers === 0) {
        if (this.rm.state.gameInProgress) {
          this.rm.state.isManualStop = true;
          this.rm.safeStopGame();
          this.rm.state.gameInProgress = false;
        }
        this.rm.gameFlow.changeMap(MAPS.TRAINING);
        return;
      }

      if (!wasPlaying && this.rm.state.gameInProgress) {
        return;
      }

      if (this.rm.state.gameInProgress) {
        if (redPlayers.length === 0 || bluePlayers.length === 0) {
          this.rm.state.isManualStop = true;
          this.rm.safeStopGame();
          this.rm.state.gameInProgress = false;
          this.rm.gameFlow.scheduleBalance();
          return;
        }

        this.rm.timeouts.set('immediateTeamBalance', () => {
          this.rm.gameFlow.checkTeamBalance();
        }, 100);
        return;
      }

      this.rm.gameFlow.scheduleBalance();
    }, TIMING.PLAYER_LEAVE_DELAY);
  },

  destroy() {
    joinTracker.destroy();
  },
};
