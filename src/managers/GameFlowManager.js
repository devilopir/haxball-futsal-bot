const MAPS = require('../../maps');
const { TIMING, Team, DURATIONS, GameMode } = require('../utils/constants');
const config = require('../../config');

class GameFlowManager {
  constructor(roomManager) {
    this.rm = roomManager;
    this.warnedPlayers = new Set();
    this.lastKnownPositions = new Map();
    this.wasPaused = false;
    this.pauseEndTime = null;
    this.lockFailsafeMs = 5000;
    this.lastHealthyState = Date.now();
    this.stuckThresholdMs = 5000;
    this.botPausedGame = false;
    this.positionMovementThreshold = 0.5;
    this.lastGameTick = 0;
    this.TICK_PAUSE_THRESHOLD = 500;
  }

  updateGameTick() {
    this.lastGameTick = Date.now();
  }

  isTickPaused() {
    if (this.lastGameTick === 0) return false;
    return (Date.now() - this.lastGameTick) > this.TICK_PAUSE_THRESHOLD;
  }

  prunePositionCache(activePlayerIds) {
    for (const playerId of this.lastKnownPositions.keys()) {
      if (!activePlayerIds.has(playerId)) {
        this.lastKnownPositions.delete(playerId);
      }
    }
  }

  removePlayerPosition(playerId) {
    this.lastKnownPositions.delete(playerId);
    this.warnedPlayers.delete(playerId);
  }

  detectMovement(playerId) {
    const player = this.rm.room.getPlayer(playerId);
    const pos = player?.position;
    if (!pos || !Number.isFinite(pos.x) || !Number.isFinite(pos.y)) {
      return false;
    }

    const current = { x: pos.x, y: pos.y };
    const prev = this.lastKnownPositions.get(playerId);
    this.lastKnownPositions.set(playerId, current);

    if (!prev) return false;

    const dx = current.x - prev.x;
    const dy = current.y - prev.y;
    const threshold = this.positionMovementThreshold;
    return (dx * dx + dy * dy) >= (threshold * threshold);
  }

  pauseAndResetActivity() {
    this.botPausedGame = true;
    this.rm.room.pauseGame(true);
    const players = this.rm.getRealPlayers().filter(p => p.team === Team.RED || p.team === Team.BLUE);
    players.forEach(p => {
      this.rm.playerActivity.update(p.id);
      this.warnedPlayers.delete(p.id);
    });
  }

  startLockFailsafe() {
    this.rm.timeouts.clear('lockFailsafe');
    this.rm.timeouts.set('lockFailsafe', () => {
      if (this.rm.state.isBalancing || this.rm.state.isMapChanging) {
        console.log('[FAILSAFE] Kilit zorla açıldı');
        this.rm.state.forceUnlockAll();
      }
    }, this.lockFailsafeMs);
  }

  clearAllGameStartTimeouts() {
    this.rm.timeouts.clear('startGame');
    this.rm.timeouts.clear('shuffleStart');
    this.rm.timeouts.clear('rotationContinue');
    this.rm.timeouts.clear('rotationCaptain');
    this.rm.timeouts.clear('handleRotation');
    this.rm.timeouts.clear('mapChangeRestart');
    this.rm.timeouts.clear('startAfterBalance');
    this.rm.timeouts.clear('balance');
    this.rm.timeouts.clear('singlePlayer');
    this.rm.timeouts.clear('startTraining');
    this.rm.timeouts.clear('retryBalance');
    this.rm.timeouts.clear('watchdogRecovery');
    this.rm.timeouts.clear('restartAfterMapDowngrade');
    this.rm.timeouts.clear('restartAfterEmptyTeam');
    this.rm.timeouts.clear('restartAfterDowngrade');
    this.rm.timeouts.clear('startAfterCaptain');
    this.rm.timeouts.clear('startAfterAutoFill');
    this.rm.timeouts.clear('checkAfterTimeout');
    this.rm.timeouts.clear('captainTeamCheck');
  }

  watchdog() {
    const players = this.rm.getActivePlayers();
    const totalPlayers = players.length;

    if (totalPlayers === 0) {
      this.lastHealthyState = Date.now();
      return;
    }

    const redPlayers = players.filter(p => p.team === Team.RED);
    const bluePlayers = players.filter(p => p.team === Team.BLUE);
    const { targetMap, playersPerTeam } = this.rm.getGameConfig();
    const scores = this.rm.room.getScores();
    const gameRunning = scores !== null;

    if (scores?.paused) {
      this.lastHealthyState = Date.now();
      return;
    }

    if (this.rm.state.isCaptainMode()) {
      if (redPlayers.length >= playersPerTeam && bluePlayers.length >= playersPerTeam) {
        console.log(`[WATCHDOG] Kaptan modu aktif ama takımlar zaten dolu! Kaptan modu sonlandırılıyor.`);
        this.rm.captainManager.endCaptainSelection();
        this.rm.safeStartGame();
        return;
      }
      this.lastHealthyState = Date.now();
      return;
    }

    if (this.rm.state.mode === GameMode.ROTATING) {
      this.lastHealthyState = Date.now();
      return;
    }

    if (this.rm.state.pendingRotation) {
      this.lastHealthyState = Date.now();
      return;
    }

    if (this.rm.state.adminStopped) {
      this.lastHealthyState = Date.now();
      return;
    }

    let problem = null;

    if (!gameRunning && this.rm.state.gameInProgress) {
      console.log(`[WATCHDOG] gameInProgress=true ama API'de oyun yok, sıfırlanıyor`);
      this.rm.state.gameInProgress = false;
    }

    if (gameRunning && !this.rm.state.gameInProgress && !this.rm.state.pendingGameStart) {
      console.log(`[WATCHDOG] API'de oyun var ama gameInProgress=false, düzeltiliyor`);
      this.rm.state.gameInProgress = true;
    }

    if (this.rm.state.isGameStartStuck()) {
      problem = 'game_start_stuck';
    }

    if (this.rm.state.isGameStopStuck()) {
      problem = 'game_stop_stuck';
    }

    if (this.rm.state.isBalancing && Date.now() - this.rm.state.lastBalanceTime > this.stuckThresholdMs) {
      problem = 'balance_stuck';
    }

    if (this.rm.state.isMapChanging && Date.now() - this.rm.state.lastMapChangeTime > this.stuckThresholdMs) {
      problem = 'map_change_stuck';
    }

    if (!problem && totalPlayers >= 2 && this.rm.state.currentMap === MAPS.TRAINING
        && targetMap !== MAPS.TRAINING && !this.rm.state.isBalancing && !this.rm.state.isMapChanging
        && Date.now() - this.lastHealthyState > 1500) {
      problem = 'wrong_map';
    }

    if (!problem && totalPlayers >= 2 && !gameRunning && !this.rm.state.isBalancing && !this.rm.state.isMapChanging) {
      if (redPlayers.length >= playersPerTeam && bluePlayers.length >= playersPerTeam) {
        problem = 'teams_full_not_started';
      } else if (redPlayers.length >= 1 && bluePlayers.length >= 1 && redPlayers.length === bluePlayers.length) {
        problem = 'teams_ready_not_started';
      } else if (Date.now() - this.lastHealthyState > this.stuckThresholdMs) {
        problem = 'game_not_starting';
      }
    }

    if (!problem && gameRunning && this.rm.state.currentMap !== MAPS.TRAINING) {
      if (redPlayers.length === 0 || bluePlayers.length === 0) {
        problem = 'empty_team_playing';
      }
    }

    if (!problem) {
      this.lastHealthyState = Date.now();
      return;
    }

    console.log(`[WATCHDOG] Problem: ${problem}, fixing...`);
    this.rm.logger.watchdog(problem, {
      gameRunning,
      redCount: redPlayers.length,
      blueCount: bluePlayers.length,
      totalPlayers,
      playersPerTeam,
      mode: this.rm.state.mode
    });
    this.rm.state.forceUnlockAll();
    this.clearAllGameStartTimeouts();

    if (gameRunning) {
      this.rm.state.isManualStop = true;
      this.rm.safeStopGame();
    }

    this.rm.timeouts.set('watchdogRecovery', () => {
      const currentPlayers = this.rm.getActivePlayers();
      const currentRed = currentPlayers.filter(p => p.team === Team.RED).length;
      const currentBlue = currentPlayers.filter(p => p.team === Team.BLUE).length;
      const { targetMap: recTargetMap } = this.rm.getGameConfig();

      if (currentRed >= 1 && currentBlue >= 1 && currentRed === currentBlue
          && currentRed <= playersPerTeam && this.rm.state.currentMap === recTargetMap) {
        console.log(`[WATCHDOG] Direkt oyun başlatılıyor - Red: ${currentRed}, Blue: ${currentBlue}`);
        const started = this.rm.safeStartGame();
        if (started) return;
      }

      this.scheduleBalance();
    }, 500);

    this.lastHealthyState = Date.now();
  }

  changeMap(newMap, forceRestart = false) {
    if (this.rm.state.currentMap !== newMap) {
      this.rm.state.startMapChangeLock();
      const wasPlaying = this.rm.state.gameInProgress;

      this.rm.timeouts.clear('singlePlayer');
      this.rm.timeouts.clear('startTraining');
      this.rm.timeouts.clear('mapChangeRestart');

      if (wasPlaying) {
        this.rm.state.isManualStop = true;
        this.rm.safeStopGame();
        this.rm.state.gameInProgress = false;
      }

      if (this.rm.state.isCaptainMode()) {
        this.rm.timeouts.clear('captain');
        this.rm.timeouts.clear('captainWarning');
        this.rm.state.endCaptainMode();
      }

      try {
        this.rm.room.setCustomStadium(JSON.stringify(newMap));
        this.rm.state.currentMap = newMap;

        if (newMap === MAPS.TRAINING) {
          this.rm.room.setScoreLimit(0);
          this.rm.room.setTimeLimit(0);
        } else {
          this.rm.room.setScoreLimit(3);
          this.rm.room.setTimeLimit(3);
        }
      } catch (error) {
        console.error('Map change error:', error.message);
        this.rm.state.endMapChangeLock();
        return;
      }

      this.rm.timeouts.set('mapChangeLockRelease', () => {
        this.rm.state.endMapChangeLock();
      }, 200);

      if (wasPlaying || forceRestart) {
        this.rm.timeouts.set('mapChangeRestart', () => {
          this.rm.safeStartGame();
        }, TIMING.MAP_CHANGE_DELAY);
      }
    }
  }

  scheduleBalance() {
    if (this.rm.state.pendingRotation || this.rm.state.mode === GameMode.ROTATING) {
      return;
    }

    if (this.rm.state.isCaptainMode()) {
      console.log('[scheduleBalance] Kaptan modu aktif, balance iptal');
      return;
    }

    if (this.rm.state.adminStopped) {
      return;
    }

    if (this.rm.state.gameInProgress && this.rm.state.currentMap === MAPS.TRAINING) {
      return;
    }

    if (this.rm.state.isBalancing || this.rm.timeouts.has('balance')) {
      return;
    }

    this.rm.logger.balance('scheduleBalance_triggered', {
      mode: this.rm.state.mode,
      gameInProgress: this.rm.state.gameInProgress
    });

    this.rm.timeouts.clear('startGame');
    this.rm.timeouts.clear('shuffleStart');
    this.rm.timeouts.clear('watchdogRecovery');
    this.rm.timeouts.clear('restartAfterMapDowngrade');
    this.rm.timeouts.clear('restartAfterEmptyTeam');
    this.rm.timeouts.clear('restartAfterDowngrade');
    this.rm.timeouts.clear('retryBalance');

    if (!this.rm.state.canStartBalance()) {
      this.rm.timeouts.set('retryBalance', () => {
        this.scheduleBalance();
      }, 300);
      return;
    }

    this.rm.state.startBalanceLock();
    this.startLockFailsafe();

    this.rm.timeouts.clear('balance');
    this.rm.timeouts.clear('singlePlayer');
    this.rm.timeouts.clear('startTraining');
    this.rm.timeouts.clear('mapChangeRestart');
    this.rm.timeouts.clear('startAfterBalance');

    this.rm.timeouts.set('balance', () => {
      const { activePlayers, totalPlayers, targetMap, playersPerTeam } = this.rm.getGameConfig();
      const currentPlayersPerTeam = this.rm.getPlayersPerTeam(this.rm.state.currentMap, totalPlayers);

      if (totalPlayers === 0) {
        this.changeMap(MAPS.TRAINING);
        this.rm.state.gameInProgress = false;
        this.rm.state.endBalanceLock();
        return;
      }

      if (totalPlayers === 1) {
        this.changeMap(MAPS.TRAINING);
        this.rm.timeouts.clear('mapChangeRestart');
        this.rm.timeouts.clear('singlePlayer');
        this.rm.timeouts.clear('startTraining');
        this.rm.timeouts.set('singlePlayer', () => {
          const currentPlayers = this.rm.getActivePlayers();
          if (currentPlayers.length !== 1) {
            this.rm.state.endBalanceLock();
            this.scheduleBalance();
            return;
          }
          const lastPlayer = currentPlayers[0];
          if (lastPlayer) {
            this.rm.safeSetTeam(lastPlayer.id, Team.RED);
          }
          if (this.rm.state.gameInProgress) {
            this.rm.state.isManualStop = true;
            this.rm.safeStopGame();
          }
          this.rm.state.gameInProgress = false;
          this.rm.timeouts.set('startTraining', () => {
            const stillOne = this.rm.getActivePlayers();
            if (stillOne.length === 1) {
              this.rm.safeStartGame();
            }
            this.rm.state.endBalanceLock();
          }, 200);
        }, TIMING.GAME_START_DELAY);
        return;
      }

      if (this.rm.state.currentMap !== targetMap || playersPerTeam !== currentPlayersPerTeam) {
        this.changeMap(targetMap);
      }

      this.rm.balanceTeams(true);

      this.rm.timeouts.set('startAfterBalance', () => {
        if (this.rm.state.isCaptainMode()) {
          this.rm.state.endBalanceLock();
          return;
        }
        this.rm.safeStartGame();
        this.rm.state.endBalanceLock();
      }, TIMING.BALANCE_DELAY);
    }, TIMING.BALANCE_DELAY);
  }

  checkInactivity() {
    if (!config.afkKickEnabled) return;
    const kickEnabled = this.rm.playerCommands?.isAfkKickEnabled() ?? true;
    if (!kickEnabled) return;

    if (!this.rm.state.gameInProgress) return;
    if (this.rm.state.currentMap === MAPS.TRAINING) return;
    if (this.rm.state.isCaptainMode()) return;

    const scores = this.rm.room.getScores();
    if (!scores) return;

    const tickPaused = this.isTickPaused();
    if (scores.paused || tickPaused) {
      this.wasPaused = true;
      this.pauseEndTime = null;
      const players = this.rm.getRealPlayers().filter(p => p.team === Team.RED || p.team === Team.BLUE);
      players.forEach(p => this.rm.playerActivity.update(p.id));
      return;
    }

    const playingPlayers = this.rm.getRealPlayers().filter(p => p.team === Team.RED || p.team === Team.BLUE);

    if (this.wasPaused || this.botPausedGame) {
      this.wasPaused = false;
      this.botPausedGame = false;
      this.pauseEndTime = Date.now();
      playingPlayers.forEach(p => {
        this.rm.playerActivity.update(p.id);
        this.warnedPlayers.delete(p.id);
      });
      return;
    }

    if (this.pauseEndTime) {
      if (Date.now() - this.pauseEndTime < 3000) {
        return;
      }
      this.pauseEndTime = null;
      playingPlayers.forEach(p => this.rm.playerActivity.update(p.id));
      this.warnedPlayers.clear();
    }

    const warningTime = (config.afkWarningTime || 4) * 1000;

    playingPlayers.forEach(player => {
      const inactiveTime = this.rm.playerActivity.getInactiveTime(player.id);

      if (inactiveTime === null) {
        this.rm.playerActivity.update(player.id);
        return;
      }

      if (inactiveTime >= DURATIONS.INACTIVITY_KICK) {
        const currentScores = this.rm.room.getScores();
        if (currentScores?.paused || this.isTickPaused()) return;
        this.warnedPlayers.delete(player.id);
        this.rm.safeKickPlayer(player.id, `${config.afkKickTimeout} saniye hareketsiz kaldın`, false);
      } else if (inactiveTime >= warningTime && !this.warnedPlayers.has(player.id)) {
        this.warnedPlayers.add(player.id);
        const remainingSeconds = Math.ceil((DURATIONS.INACTIVITY_KICK - inactiveTime) / 1000);
        this.rm.room.sendAnnouncement(
          `${player.name}, ${remainingSeconds} saniye içinde hareket etmezsen atılacaksın!`,
          player.id, 0xFF0000, 'bold', 2
        );
      }
    });
  }

  clearPlayerWarning(playerId) {
    this.warnedPlayers.delete(playerId);
  }

  checkMapUpgrade() {
    if (!this.rm.state.gameInProgress) return;
    if (this.rm.state.currentMap === MAPS.TRAINING) return;
    if (this.rm.state.isCaptainMode()) return;
    if (this.rm.state.isBalancing || this.rm.state.isMapChanging) return;

    const { totalPlayers, targetMap, playersPerTeam } = this.rm.getGameConfig();
    const currentPlayersPerTeam = this.rm.getPlayersPerTeam(this.rm.state.currentMap, totalPlayers);

    if (this.rm.state.currentMap !== targetMap && playersPerTeam > currentPlayersPerTeam) {
      console.log(`[MAP_UPGRADE] ${currentPlayersPerTeam}v${currentPlayersPerTeam} -> ${playersPerTeam}v${playersPerTeam}`);
      this.rm.state.isManualStop = true;
      this.rm.safeStopGame();
      this.rm.state.gameInProgress = false;
      this.scheduleBalance();
    }
  }

  checkTeamBalance() {
    if (this._adjustingTeams) return;
    if (!this.rm.state.gameInProgress) return;
    if (this.rm.state.currentMap === MAPS.TRAINING) return;
    if (this.rm.state.isCaptainMode()) return;
    if (this.rm.state.mode !== GameMode.IDLE) return;
    if (this.rm.state.isBalancing || this.rm.state.isMapChanging) return;
    if (this.rm.state.unbalancedMode) return;
    const balanceScores = this.rm.room.getScores();
    if (balanceScores?.paused) return;

    const { totalPlayers, targetMap, playersPerTeam } = this.rm.getGameConfig();
    const currentPlayersPerTeam = this.rm.getPlayersPerTeam(this.rm.state.currentMap, totalPlayers);

    const activePlayers = this.rm.getActivePlayers();
    const redPlayers = [], bluePlayers = [], specPlayers = [];
    for (const p of activePlayers) {
      if (p.team === Team.RED) redPlayers.push(p);
      else if (p.team === Team.BLUE) bluePlayers.push(p);
      else if (p.team === Team.SPECTATORS && !this.rm.playerActivity.isAFK(p.id)) specPlayers.push(p);
    }
    const redCount = redPlayers.length;
    const blueCount = bluePlayers.length;

    if (this.rm.state.currentMap !== targetMap) {
      if (redCount === blueCount && redCount >= 1 && redCount <= playersPerTeam) {
        console.log(`[checkTeamBalance] Takımlar dengeli (${redCount}v${blueCount}), harita değişiyor ama oyun devam edecek`);
        this.rm.state.isManualStop = true;
        this.rm.safeStopGame();
        this.rm.state.gameInProgress = false;
        this.changeMap(targetMap);
        this.rm.timeouts.set('restartAfterMapDowngrade', () => {
          this.rm.safeStartGame();
        }, TIMING.MAP_CHANGE_DELAY);
        return;
      }
      console.log(`[MAP_CHANGE] checkTeamBalance: ${currentPlayersPerTeam}v${currentPlayersPerTeam} -> ${playersPerTeam}v${playersPerTeam}`);
      this.rm.state.isManualStop = true;
      this.rm.safeStopGame();
      this.rm.state.gameInProgress = false;
      this.scheduleBalance();
      return;
    }

    if (redPlayers.length === 0 || bluePlayers.length === 0) {
      const emptyTeam = redPlayers.length === 0 ? Team.RED : Team.BLUE;
      const otherTeam = emptyTeam === Team.RED ? bluePlayers : redPlayers;
      const otherTeamCount = otherTeam.length;

      if (specPlayers.length >= otherTeamCount) {
        console.log(`[TEAM_EMPTY] Spec'ten ${otherTeamCount} oyuncu ekleniyor`);

        for (let i = 0; i < otherTeamCount && i < specPlayers.length; i++) {
          this.rm.safeSetTeam(specPlayers[i].id, emptyTeam);
        }

        const { targetMap } = this.rm.getGameConfig();
        const newActivePlayers = this.rm.getActivePlayers();
        const newRedCount = newActivePlayers.filter(p => p.team === Team.RED).length;
        const newBlueCount = newActivePlayers.filter(p => p.team === Team.BLUE).length;

        if (newRedCount === newBlueCount && newRedCount > 0) {
          if (this.rm.state.currentMap !== targetMap) {
            this.rm.state.isManualStop = true;
            this.rm.safeStopGame();
            this.rm.state.gameInProgress = false;
            this.changeMap(targetMap);
            this.rm.balanceTeams(true);
            this.rm.timeouts.set('restartAfterEmptyTeam', () => {
              this.rm.safeStartGame();
            }, TIMING.BALANCE_DELAY);
          }
          return;
        }
      }

      console.log('[TEAM_EMPTY] Takım boş, yeniden başlatılıyor');
      this.rm.state.isManualStop = true;
      this.rm.safeStopGame();
      this.rm.state.gameInProgress = false;
      this.scheduleBalance();
      return;
    }

    if (redPlayers.length !== bluePlayers.length) {
      if (specPlayers.length > 0) {
        const smallerTeam = redPlayers.length < bluePlayers.length ? Team.RED : Team.BLUE;
        const smallerTeamPlayers = smallerTeam === Team.RED ? redPlayers : bluePlayers;
        const neededCount = Math.abs(redPlayers.length - bluePlayers.length);

        if (specPlayers.length <= neededCount) {
          specPlayers.forEach(p => this.rm.safeSetTeam(p.id, smallerTeam));
          return;
        }

        const captain = smallerTeamPlayers[0];
        if (!captain) return;
        this.rm.timeouts.clear('balance');
        this.rm.timeouts.clear('startAfterBalance');
        this.rm.timeouts.clear('mapChangeRestart');
        this.pauseAndResetActivity();
        this.rm.captainManager.startMidGameSelection(captain, specPlayers, neededCount, smallerTeam);
      } else {
        const smallerCount = Math.min(redPlayers.length, bluePlayers.length);
        const largerTeam = redPlayers.length > bluePlayers.length ? Team.RED : Team.BLUE;
        const largerTeamPlayers = largerTeam === Team.RED ? redPlayers : bluePlayers;
        const excessCount = Math.abs(redPlayers.length - bluePlayers.length);

        if (smallerCount >= 1) {
          console.log(`[TEAM_BALANCE] Spec boş, ${largerTeamPlayers.length}v${smallerCount} -> ${smallerCount}v${smallerCount} düşürülüyor`);

          this._adjustingTeams = true;
          for (let i = 0; i < excessCount; i++) {
            const playerToMove = largerTeamPlayers[largerTeamPlayers.length - 1 - i];
            if (playerToMove) {
              this.rm.safeSetTeam(playerToMove.id, Team.SPECTATORS);
            }
          }
          this._adjustingTeams = false;

          const expectedCount = smallerCount;
          const expectedTotalPlaying = expectedCount * 2;
          const targetMap = this.rm.getMapForPlayerCount(expectedTotalPlaying);

          if (this.rm.state.currentMap !== targetMap) {
            this.rm.state.isManualStop = true;
            this.rm.safeStopGame();
            this.rm.state.gameInProgress = false;
            this.changeMap(targetMap);
            this.rm.timeouts.set('restartAfterDowngrade', () => {
              this.rm.safeStartGame();
            }, TIMING.MAP_CHANGE_DELAY);
          }
          return;
        }

        console.log('[TEAM_BALANCE] Dengeleme yapılamadı, yeniden başlatılıyor');
        this.rm.state.isManualStop = true;
        this.rm.safeStopGame();
        this.rm.state.gameInProgress = false;
        this.scheduleBalance();
      }
      return;
    }

    const { playersPerTeam: requiredPerTeam } = this.rm.getGameConfig();
    const redNeeded = requiredPerTeam - redPlayers.length;
    const blueNeeded = requiredPerTeam - bluePlayers.length;
    const totalNeeded = redNeeded + blueNeeded;

    if (totalNeeded > 0 && specPlayers.length >= totalNeeded) {
      if (specPlayers.length === totalNeeded) {
        let idx = 0;
        for (let i = 0; i < redNeeded && idx < specPlayers.length; i++) {
          this.rm.safeSetTeam(specPlayers[idx++].id, Team.RED);
        }
        for (let i = 0; i < blueNeeded && idx < specPlayers.length; i++) {
          this.rm.safeSetTeam(specPlayers[idx++].id, Team.BLUE);
        }
        return;
      }

      if (redNeeded > 0 && blueNeeded > 0) {
        const redCaptain = redPlayers[0];
        if (redCaptain) {
          this.rm.timeouts.clear('balance');
          this.rm.timeouts.clear('startAfterBalance');
          this.rm.timeouts.clear('mapChangeRestart');
          this.pauseAndResetActivity();
          this.rm.captainManager.startDualTeamSelection(redCaptain, specPlayers, redNeeded, blueNeeded, bluePlayers);
        }
      } else if (redNeeded > 0) {
        const redCaptain = redPlayers[0];
        if (redCaptain) {
          this.rm.timeouts.clear('balance');
          this.rm.timeouts.clear('startAfterBalance');
          this.rm.timeouts.clear('mapChangeRestart');
          this.pauseAndResetActivity();
          this.rm.captainManager.startMidGameSelection(redCaptain, specPlayers, redNeeded, Team.RED);
        }
      } else if (blueNeeded > 0) {
        const blueCaptain = bluePlayers[0];
        if (blueCaptain) {
          this.rm.timeouts.clear('balance');
          this.rm.timeouts.clear('startAfterBalance');
          this.rm.timeouts.clear('mapChangeRestart');
          this.pauseAndResetActivity();
          this.rm.captainManager.startMidGameSelection(blueCaptain, specPlayers, blueNeeded, Team.BLUE);
        }
      }
    } else if (totalNeeded > 0 && specPlayers.length < totalNeeded) {
      if (redPlayers.length === bluePlayers.length && redPlayers.length >= 1) {
        const { targetMap } = this.rm.getGameConfig();
        if (this.rm.state.currentMap !== targetMap) {
          console.log(`[TEAM_BALANCE] Takımlar eşit ama eksik, harita düşürülüyor: ${redPlayers.length}v${bluePlayers.length}`);
          this.rm.state.isManualStop = true;
          this.rm.safeStopGame();
          this.rm.state.gameInProgress = false;
          this.changeMap(targetMap);
          this.rm.timeouts.set('restartAfterDowngrade', () => {
            this.rm.safeStartGame();
          }, TIMING.MAP_CHANGE_DELAY);
        }
        return;
      }

      console.log(`[TEAM_BALANCE] Yeterli yedek yok (need: ${totalNeeded}, have: ${specPlayers.length}), restart`);
      this.rm.state.isManualStop = true;
      this.rm.safeStopGame();
      this.rm.state.gameInProgress = false;
      this.scheduleBalance();
    }
  }
}

module.exports = GameFlowManager;
