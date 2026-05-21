const { TIMING, Team, GameMode, PLAYER_SIZE } = require('../../utils/constants');
const MAPS = require('../../../maps');
const db = require('../../database/Database');

const STREAK_COLORS = {
  normal: [
    { angle: 0, textColor: 0xFFFFFF, colors: [0xE56E56, 0xB33D2C, 0xE56E56] },
    { angle: 0, textColor: 0xFFFFFF, colors: [0xCC4433, 0x992211, 0xCC4433] },
    { angle: 60, textColor: 0xFFFFFF, colors: [0xD94545, 0xAA3333, 0xD94545] },
    { angle: 45, textColor: 0xFFFFFF, colors: [0xC94040, 0x9A2E2E, 0xC94040] }
  ],
  streak2: [
    { angle: 90, textColor: 0xFFFFFF, colors: [0xFF4444, 0xCC0000, 0xFF4444] },
    { angle: 45, textColor: 0x000000, colors: [0xFF6B35, 0xFF4500, 0xFF6B35] },
    { angle: 60, textColor: 0xFFFFFF, colors: [0xDC143C, 0x8B0000, 0xDC143C] }
  ],
  streak4: [
    { angle: 90, textColor: 0x000000, colors: [0xFFD700, 0xFF8C00, 0xFFD700] },
    { angle: 45, textColor: 0x000000, colors: [0xFFA500, 0xFFD700, 0xFFA500] },
    { angle: 60, textColor: 0x000000, colors: [0xFFDF00, 0xFFAA00, 0xFFDF00] }
  ],
  streak8: [
    { angle: 90, textColor: 0xFFFFFF, colors: [0x8B0000, 0x4B0000, 0x8B0000] },
    { angle: 45, textColor: 0xFFFFFF, colors: [0xB22222, 0x6B0000, 0xB22222] }
  ]
};

const BLUE_COLORS = {
  normal: [
    { angle: 0, textColor: 0xFFFFFF, colors: [0x5689E5, 0x2B5BB8, 0x5689E5] },
    { angle: 0, textColor: 0xFFFFFF, colors: [0x4477CC, 0x225599, 0x4477CC] },
    { angle: 60, textColor: 0xFFFFFF, colors: [0x4A90D9, 0x2E6EB3, 0x4A90D9] },
    { angle: 45, textColor: 0xFFFFFF, colors: [0x3D7AC7, 0x2A5A9A, 0x3D7AC7] }
  ],
  streak2: [
    { angle: 90, textColor: 0xFFFFFF, colors: [0x00BFFF, 0x0080FF, 0x00BFFF] },
    { angle: 45, textColor: 0xFFFFFF, colors: [0x1E90FF, 0x0066CC, 0x1E90FF] },
    { angle: 60, textColor: 0xFFFFFF, colors: [0x4169E1, 0x00008B, 0x4169E1] }
  ],
  streak4: [
    { angle: 90, textColor: 0x000000, colors: [0x00FFFF, 0x00CED1, 0x00FFFF] },
    { angle: 45, textColor: 0xFFFFFF, colors: [0x9370DB, 0x8A2BE2, 0x9370DB] },
    { angle: 60, textColor: 0x000000, colors: [0x7FFFD4, 0x40E0D0, 0x7FFFD4] }
  ],
  streak8: [
    { angle: 90, textColor: 0xFFFFFF, colors: [0x0D1B2A, 0x1B3A5C, 0x0D1B2A] },
    { angle: 45, textColor: 0x4488FF, colors: [0x0A1628, 0x162D4A, 0x0A1628] }
  ]
};

module.exports = {
  onGameStart() {
    this.rm.timeouts.clear('gameStartSafety');
    this.rm.state.confirmGameStarted();
    this.rm.state.adminStopped = false;

    this.rm.timeouts.clear('captain');
    this.rm.timeouts.clear('captainWarning');
    this.rm.state.endCaptainMode();
    if (this.rm.captainManager) {
      this.rm.captainManager.isMidGameReplacement = false;
      this.rm.captainManager.midGameTargetTeam = null;
      this.rm.captainManager.isDualSelection = false;
      this.rm.captainManager.dualSelectionState = null;
    }

    this.rm.state.mode = GameMode.IDLE;

    this.rm.initMatchStats();
    this.rm.state.resetGoalkeepers();
    this.rm.state.initMatchStats();
    this.rm.state.resetAllPlayerRadiuses();
    this.stopCelebration();
    this.hideCelebrationDiscs();

    const playingPlayers = this.rm.getRealPlayers().filter(p => p.team === Team.RED || p.team === Team.BLUE);
    playingPlayers.forEach(p => {
      this.rm.playerActivity.update(p.id);
      try {
        this.rm.room.setPlayerDiscProperties(p.id, { radius: PLAYER_SIZE.DEFAULT_RADIUS });
      } catch (e) {}
    });

    try { this.rm.room.startRecording(); } catch (e) {}

    if (this.rm.state.currentMap === MAPS.TRAINING) {
      console.log('[GAME] Training mode started');
      return;
    }

    this.rm.room.sendAnnouncement(
      'Oyun başladı!',
      null, 0x00FF00, 'bold', 1
    );

    this.rm.logger.gameStart();

    this._postGameStart().catch(e => console.error('[GAME_START] Error:', e.message));
  },

  async _postGameStart() {
    await this.showTeamLineup();

    this.rm.timeouts.set('detectGoalkeepers', () => {
      this.detectGoalkeepers();
    }, 5000);

    this.randomizeTeamColors();
  },

  randomizeTeamColors() {
    try {
      const redStreak = this.rm.state.getTeamStreak('red')?.wins || 0;
      const blueStreak = this.rm.state.getTeamStreak('blue')?.wins || 0;

      const getStreakTier = (streak) => {
        if (streak >= 8) return 'streak8';
        if (streak >= 4) return 'streak4';
        if (streak >= 2) return 'streak2';
        return 'normal';
      };

      const redTier = getStreakTier(redStreak);
      const blueTier = getStreakTier(blueStreak);

      const redOptions = STREAK_COLORS[redTier];
      const blueOptions = BLUE_COLORS[blueTier];

      const redColor = redOptions[Math.floor(Math.random() * redOptions.length)];
      const blueColor = blueOptions[Math.floor(Math.random() * blueOptions.length)];

      this.rm.room.setTeamColors(
        Team.RED,
        redColor.angle,
        redColor.textColor,
        redColor.colors
      );

      this.rm.room.setTeamColors(
        Team.BLUE,
        blueColor.angle,
        blueColor.textColor,
        blueColor.colors
      );
    } catch (e) {
      console.error('Team colors error:', e.message);
    }
  },

  async showTeamLineup() {
    const POS_ORDER = { GK: 0, DEF: 1, MID: 2, FWD: 3 };

    const getPlayerTag = async (p) => {
      const loggedUser = this.rm.authManager?.getLoggedInUser(p.id);
      if (!loggedUser) return p.name;
      const user = await db.get('SELECT position FROM users WHERE id = ?', [loggedUser.userId]);
      return user?.position ? `[${user.position}] ${p.name}` : p.name;
    };

    const sortByPos = async (players) => {
      const mapped = [];
      for (const p of players) {
        const loggedUser = this.rm.authManager?.getLoggedInUser(p.id);
        let pos = null;
        if (loggedUser) {
          const u = await db.get('SELECT position FROM users WHERE id = ?', [loggedUser.userId]);
          pos = u?.position || null;
        }
        mapped.push({ p, pos, order: pos !== null ? (POS_ORDER[pos] ?? 99) : 99 });
      }
      return mapped.sort((a, b) => a.order - b.order);
    };

    const redPlayers = this.rm.getRealPlayers().filter(p => p.team === Team.RED);
    const bluePlayers = this.rm.getRealPlayers().filter(p => p.team === Team.BLUE);

    const sortedRed = await sortByPos(redPlayers);
    const sortedBlue = await sortByPos(bluePlayers);

    const redTags = [];
    for (const { p } of sortedRed) {
      redTags.push(await getPlayerTag(p));
    }
    const blueTags = [];
    for (const { p } of sortedBlue) {
      blueTags.push(await getPlayerTag(p));
    }

    const redLine = redTags.join(' | ');
    const blueLine = blueTags.join(' | ');

    if (redLine) this.rm.room.sendAnnouncement(`🔴 ${redLine}`, null, 0xFF6666, 'normal', 0);
    if (blueLine) this.rm.room.sendAnnouncement(`🔵 ${blueLine}`, null, 0x6699FF, 'normal', 0);
  },

  detectGoalkeepers() {
    if (!this.rm.state.gameInProgress) return;

    const players = this.rm.getRealPlayers();
    const redPlayers = players.filter(p => p.team === Team.RED);
    const bluePlayers = players.filter(p => p.team === Team.BLUE);

    if (redPlayers.length < 3 || bluePlayers.length < 3) return;

    if (redPlayers.length > 0) {
      let redGK = null;
      let minX = Infinity;
      for (const p of redPlayers) {
        try {
          const playerData = this.rm.room.getPlayer(p.id);
          if (playerData && playerData.position) {
            if (playerData.position.x < minX) {
              minX = playerData.position.x;
              redGK = p;
            }
          }
        } catch (e) {
          console.error('Red GK detection error:', e.message);
        }
      }
      if (redGK) {
        this.rm.state.setGoalkeeper('red', redGK);
      }
    }

    if (bluePlayers.length > 0) {
      let blueGK = null;
      let maxX = -Infinity;
      for (const p of bluePlayers) {
        try {
          const playerData = this.rm.room.getPlayer(p.id);
          if (playerData && playerData.position) {
            if (playerData.position.x > maxX) {
              maxX = playerData.position.x;
              blueGK = p;
            }
          }
        } catch (e) {
          console.error('Blue GK detection error:', e.message);
        }
      }
      if (blueGK) {
        this.rm.state.setGoalkeeper('blue', blueGK);
      }
    }

    const redGK = this.rm.state.getGoalkeeper('red');
    const blueGK = this.rm.state.getGoalkeeper('blue');

    if (redGK || blueGK) {
      let gkLog = '[GK] ';
      if (redGK) gkLog += `Red: ${redGK.name}`;
      if (redGK && blueGK) gkLog += ' | ';
      if (blueGK) gkLog += `Blue: ${blueGK.name}`;
      console.log(gkLog);

      const redPart = redGK ? `🔴 GK ${redGK.name}` : '';
      const bluePart = blueGK ? `🔵 GK ${blueGK.name}` : '';
      const gkLine = [redPart, bluePart].filter(Boolean).join('  |  ');
      this.rm.room.sendAnnouncement(gkLine, null, 0xFFFFFF, 'bold', 0);
    }
  },

  onGameStop(byPlayer) {
    this.stopCelebration();
    if (this.rm.playerCommands?.vipPauseTimeout) {
      clearTimeout(this.rm.playerCommands.vipPauseTimeout);
      this.rm.playerCommands.vipPauseTimeout = null;
    }
    if (this.rm.captainManager) {
      this.rm.captainManager.isMidGameReplacement = false;
      this.rm.captainManager.midGameTargetTeam = null;
    }
    this.rm.state.confirmGameStopped();
    this.rm.logger.gameStop(byPlayer);

    if (byPlayer !== null) {
      this.rm.state.adminStopped = true;
      this.rm.state.isManualStop = false;
      return;
    }

    if (this.rm.state.isManualStop) {
      this.rm.state.isManualStop = false;
      return;
    }

    if (this.rm.state.pendingRotation) {
      const rotationScores = this.rm.state.pendingRotation;
      this.rm.logger.rotation('onGameStop_rotation_scheduled', {
        scores: { red: rotationScores.red, blue: rotationScores.blue },
        delayMs: TIMING.POST_VICTORY_DELAY
      });
      this.rm.timeouts.set('handleRotation', () => {
        this.rm.state.pendingRotation = null;
        this.rm.handleRotation(rotationScores);
      }, TIMING.POST_VICTORY_DELAY);
      return;
    }

    const scores = this.rm.room.getScores();
    if (scores && scores.red === scores.blue) {
      this.rm.state.mode = GameMode.ROTATING;
      this.rm.timeouts.set('handleRotation', () => {
        this.rm.handleRotation(scores);
      }, TIMING.POST_VICTORY_DELAY);
    }
  },

  onTeamVictory(scores) {
    if (this.rm.state.currentMap !== MAPS.V2 && this.rm.state.currentMap !== MAPS.V3) return;

    this.rm.state.mode = GameMode.ROTATING;

    const redPlayers = this.rm.getRealPlayers().filter(p => p.team === Team.RED);
    const bluePlayers = this.rm.getRealPlayers().filter(p => p.team === Team.BLUE);

    const winner = scores.red > scores.blue ? 'red' : scores.blue > scores.red ? 'blue' : 'draw';
    this.rm.state.recordMatchResult(winner);

    const winningTeam = winner === 'red' ? Team.RED : winner === 'blue' ? Team.BLUE : 0;
    this.rm.logger.teamVictory(winningTeam, scores);

    this.rm.state.pendingRotation = scores;
    this.rm.logger.rotation('pendingRotation_set', {
      scores: { red: scores.red, blue: scores.blue },
      winner
    });
    this.rm.safeStopGame();
    this.rm.state.gameInProgress = false;

    this._postVictory(redPlayers, bluePlayers, winner, scores).catch(e => console.error('[VICTORY] Error:', e.message));
  },

  async _postVictory(redPlayers, bluePlayers, winner, scores) {
    const isFullMatch = redPlayers.length >= 2 && bluePlayers.length >= 2;

    await this.showMatchStats(redPlayers, bluePlayers, scores);

    if (isFullMatch) {
      this.updatePlayerWinStreaks(redPlayers, bluePlayers, winner);
      this.rm.state.resetMatchGoalStreaks();
      await this.updatePersistentStats(redPlayers, bluePlayers, winner, scores);
    }

    await this.checkAFKPlayers();

    this._sendReplay(scores, winner, redPlayers, bluePlayers);
  },

  async checkAFKPlayers() {
    const afkPlayers = this.rm.playerActivity.getAFKPlayers();
    const kickEnabled = this.rm.playerCommands?.isAfkKickEnabled() ?? true;
    let kickedCount = 0;

    for (const afkPlayer of afkPlayers) {
      const afkAuth = this.rm.getPlayerAuthData(afkPlayer.id)?.auth;
      const afkUser = afkAuth ? await db.get('SELECT allowed_room FROM users WHERE auth = ?', [afkAuth]) : null;
      const isVip = afkUser?.allowed_room === 'vip';
      const MAX_AFK_MATCHES = isVip ? 5 : 3;
      if (this.rm.playerCommands?.isAdmin({ id: afkPlayer.id })) {
        continue;
      }

      const newCount = this.rm.playerActivity.incrementAFKMatchCount(afkPlayer.id);

      if (newCount >= MAX_AFK_MATCHES && kickEnabled) {
        this.rm.room.sendAnnouncement(
          `${afkPlayer.name} ${MAX_AFK_MATCHES} maçtır AFK, atıldı!`,
          null, 0xFF6600, 'bold', 1
        );
        this.rm.safeKickPlayer(afkPlayer.id, `${MAX_AFK_MATCHES} maçtır AFK`, false);
        kickedCount++;
      } else if (newCount >= MAX_AFK_MATCHES && !kickEnabled) {
        this.rm.room.sendAnnouncement(
          `${afkPlayer.name} ${newCount} maçtır AFK (atma kapalı)`,
          null, 0xFF6600, 'normal', 1
        );
      } else {
        const remaining = MAX_AFK_MATCHES - newCount;
        this.rm.room.sendAnnouncement(
          `${afkPlayer.name} AFK - ${remaining} maç sonra atılacak`,
          afkPlayer.id, 0xFFFF00, 'normal', 1
        );
      }
    }

    if (kickedCount > 0) {
      this.rm.timeouts.set('afkBalanceCheck', () => {
        this.rm.gameFlow.checkTeamBalance();
      }, 100);
    }
  },
};
