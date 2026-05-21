const { GameMode, PLAYER_SIZE } = require('../utils/constants');
const MAPS = require('../../maps');

const MAX_TOUCH_HISTORY = 5;

class RoomState {
  constructor() {
    this.gameInProgress = false;
    this.currentMap = null;
    this.mode = GameMode.IDLE;
    this.captain = {
      active: false,
      player: null,
      selectedPlayers: [],
      neededCount: 0
    };
    this.pendingRotation = null;
    this.isManualStop = false;
    this.adminStopped = false;
    this.unbalancedMode = false;

    this.isBalancing = false;
    this.lastBalanceTime = 0;
    this.isMapChanging = false;
    this.lastMapChangeTime = 0;
    this.balanceDebounceMs = 500;

    this.pendingGameStart = false;
    this.pendingGameStop = false;
    this.pendingGameStartTime = 0;
    this.pendingGameStopTime = 0;
    this.pendingOperationTimeoutMs = 3000;
    this.goalkeepers = {
      red: null,
      blue: null
    };
    this.goalsConceded = {
      red: 0,
      blue: 0
    };
    this.goalkeeperSaves = {
      red: 0,
      blue: 0
    };
    this.ballTouches = new Map();
    this.ballTouchHistory = [];
    this.teamStreaks = {
      red: { wins: 0, unbeaten: 0 },
      blue: { wins: 0, unbeaten: 0 }
    };
    this.playerGoalStreaks = new Map();
    this.playerWinStreaks = new Map();
    this.lastScorerId = null;
    this.playerRadiuses = new Map();
  }

  initMatchStats() {
    this.ballTouches = new Map();
    this.ballTouchHistory = [];
  }

  recordMatchResult(winner) {
    if (winner === 'red') {
      this.teamStreaks.red.wins++;
      this.teamStreaks.red.unbeaten++;
      this.teamStreaks.blue.wins = 0;
      this.teamStreaks.blue.unbeaten = 0;
    } else if (winner === 'blue') {
      this.teamStreaks.blue.wins++;
      this.teamStreaks.blue.unbeaten++;
      this.teamStreaks.red.wins = 0;
      this.teamStreaks.red.unbeaten = 0;
    } else {
      this.teamStreaks.red.wins = 0;
      this.teamStreaks.blue.wins = 0;
      this.teamStreaks.red.unbeaten++;
      this.teamStreaks.blue.unbeaten++;
    }
  }

  getTeamStreak(team) {
    return this.teamStreaks[team] || { wins: 0, unbeaten: 0 };
  }

  recordBallTouch(playerId, playerData = null) {
    if (playerId === undefined || playerId === null) return;

    const current = this.ballTouches.get(playerId) || 0;
    this.ballTouches.set(playerId, current + 1);

    if (playerData && typeof playerData === 'object') {
      const lastTouch = this.ballTouchHistory[this.ballTouchHistory.length - 1];
      if (!lastTouch || lastTouch.playerId !== playerId) {
        this.ballTouchHistory.push({
          playerId,
          auth: playerData.auth || null,
          team: playerData.team !== undefined ? playerData.team : null,
          name: playerData.name || 'Unknown',
          timestamp: Date.now()
        });

        if (this.ballTouchHistory.length > MAX_TOUCH_HISTORY) {
          this.ballTouchHistory.shift();
        }
      }
    }
  }

  getAssistCandidate(scorerPlayerId, scorerTeam) {
    if (scorerPlayerId === undefined || scorerTeam === undefined) return null;

    const history = this.ballTouchHistory.slice().reverse();
    for (const touch of history) {
      if (touch.playerId !== scorerPlayerId && touch.team === scorerTeam) {
        return touch;
      }
    }
    return null;
  }

  getAllBallTouches() {
    return this.ballTouches;
  }

  setGoalkeeper(team, player) {
    if (team !== 'red' && team !== 'blue') return;
    this.goalkeepers[team] = player;
  }

  getGoalkeeper(team) {
    return this.goalkeepers[team] || null;
  }

  resetGoalkeepers() {
    this.goalkeepers = { red: null, blue: null };
    this.goalsConceded = { red: 0, blue: 0 };
    this.goalkeeperSaves = { red: 0, blue: 0 };
  }

  recordGoalkeeperSave(team) {
    if (team !== 'red' && team !== 'blue') return;
    this.goalkeeperSaves[team]++;
  }

  getGoalkeeperSaves(team) {
    return this.goalkeeperSaves[team] || 0;
  }

  recordGoalConceded(team) {
    if (team !== 'red' && team !== 'blue') return;
    this.goalsConceded[team]++;
  }

  startCaptainMode(captain, neededCount) {
    if (!captain) return;
    this.mode = GameMode.CAPTAIN_SELECTION;
    this.captain.active = true;
    this.captain.player = captain;
    this.captain.selectedPlayers = [];
    this.captain.neededCount = neededCount || 0;
  }

  endCaptainMode() {
    this.mode = GameMode.IDLE;
    this.captain.active = false;
    this.captain.player = null;
    this.captain.selectedPlayers = [];
    this.captain.neededCount = 0;
  }

  addSelectedPlayer(player) {
    if (player) {
      this.captain.selectedPlayers.push(player);
    }
  }

  getNeededCount() {
    return this.captain.neededCount;
  }

  getRemainingSelections() {
    return Math.max(0, this.captain.neededCount - this.captain.selectedPlayers.length);
  }

  isCaptainMode() {
    return this.captain.active && this.mode === GameMode.CAPTAIN_SELECTION;
  }

  getCurrentCaptain() {
    return this.captain.player;
  }

  recordPlayerGoal(auth, isOwnGoal) {
    if (!auth) return 0;

    if (isOwnGoal) {
      this.playerGoalStreaks.set(auth, 0);
      this.lastScorerId = null;
      return 0;
    }

    if (this.lastScorerId === auth) {
      const current = this.playerGoalStreaks.get(auth) || 0;
      this.playerGoalStreaks.set(auth, current + 1);
    } else {
      if (this.lastScorerId) {
        this.playerGoalStreaks.set(this.lastScorerId, 0);
      }
      this.playerGoalStreaks.set(auth, 1);
      this.lastScorerId = auth;
    }

    return this.playerGoalStreaks.get(auth);
  }

  getPlayerGoalStreak(auth) {
    return this.playerGoalStreaks.get(auth) || 0;
  }

  recordPlayerMatchResult(auth, won) {
    if (!auth) return { wins: 0, losses: 0 };

    if (!this.playerWinStreaks.has(auth)) {
      this.playerWinStreaks.set(auth, { wins: 0, losses: 0 });
    }

    const streak = this.playerWinStreaks.get(auth);
    if (won) {
      streak.wins++;
      streak.losses = 0;
    } else {
      streak.losses++;
      streak.wins = 0;
    }

    return streak;
  }

  getPlayerWinStreak(auth) {
    return this.playerWinStreaks.get(auth) || { wins: 0, losses: 0 };
  }

  resetMatchGoalStreaks() {
    this.lastScorerId = null;
  }

  getPlayerRadius(playerId) {
    return this.playerRadiuses.get(playerId) || PLAYER_SIZE.DEFAULT_RADIUS;
  }

  setGoalRadius(playerId) {
    this.playerRadiuses.set(playerId, PLAYER_SIZE.GOAL_RADIUS);
    return PLAYER_SIZE.GOAL_RADIUS;
  }

  setOwnGoalRadius(playerId) {
    this.playerRadiuses.set(playerId, PLAYER_SIZE.OWN_GOAL_RADIUS);
    return PLAYER_SIZE.OWN_GOAL_RADIUS;
  }

  resetPlayerRadius(playerId) {
    this.playerRadiuses.set(playerId, PLAYER_SIZE.DEFAULT_RADIUS);
    return PLAYER_SIZE.DEFAULT_RADIUS;
  }

  resetAllPlayerRadiuses() {
    this.playerRadiuses.clear();
  }

  reset() {
    this.gameInProgress = false;
    this.mode = GameMode.IDLE;
    this.captain = {
      active: false,
      player: null,
      selectedPlayers: [],
      neededCount: 0
    };
    this.pendingRotation = null;
    this.isManualStop = false;
    this.ballTouches = new Map();
    this.ballTouchHistory = [];
    this.isBalancing = false;
    this.isMapChanging = false;
    this.pendingGameStart = false;
    this.pendingGameStop = false;
  }

  canStartBalance() {
    if (this.isBalancing) return false;
    const now = Date.now();
    if (now - this.lastBalanceTime < this.balanceDebounceMs) return false;
    if (this.isMapChanging) return false;
    return true;
  }

  startBalanceLock() {
    this.isBalancing = true;
    this.lastBalanceTime = Date.now();
  }

  endBalanceLock() {
    this.isBalancing = false;
  }

  startMapChangeLock() {
    this.isMapChanging = true;
    this.lastMapChangeTime = Date.now();
  }

  endMapChangeLock() {
    this.isMapChanging = false;
  }

  forceUnlockAll() {
    this.isBalancing = false;
    this.isMapChanging = false;
    this.pendingGameStart = false;
    this.pendingGameStop = false;
    this.gameInProgress = false;
  }

  requestGameStart() {
    if (this.pendingGameStart || this.pendingGameStop) return false;
    this.pendingGameStart = true;
    this.pendingGameStartTime = Date.now();
    return true;
  }

  confirmGameStarted() {
    this.pendingGameStart = false;
    this.gameInProgress = true;
  }

  requestGameStop() {
    if (this.pendingGameStop) return false;
    this.pendingGameStop = true;
    this.pendingGameStopTime = Date.now();
    return true;
  }

  confirmGameStopped() {
    this.pendingGameStop = false;
    this.pendingGameStart = false;
    this.gameInProgress = false;
  }

  isGameStartStuck() {
    if (!this.pendingGameStart) return false;
    return Date.now() - this.pendingGameStartTime > this.pendingOperationTimeoutMs;
  }

  isGameStopStuck() {
    if (!this.pendingGameStop) return false;
    return Date.now() - this.pendingGameStopTime > this.pendingOperationTimeoutMs;
  }

  hasPendingOperation() {
    return this.pendingGameStart || this.pendingGameStop;
  }
}

module.exports = RoomState;
