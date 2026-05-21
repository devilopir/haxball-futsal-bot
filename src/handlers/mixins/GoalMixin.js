const { Team } = require('../../utils/constants');
const MAPS = require('../../../maps');
const db = require('../../database/Database');

module.exports = {
  onPlayerBallKick(player) {
    if (!player) return;

    this.rm.playerActivity.update(player.id);
    this.rm.gameFlow.clearPlayerWarning(player.id);

    const authData = this.rm.getPlayerAuthData(player.id);
    if (!authData) return;

    let kickPosition = null;
    try {
      const p = this.rm.room.getPlayer(player.id);
      if (p?.position) kickPosition = { x: p.position.x, y: p.position.y };
    } catch (e) {}

    const playerData = {
      ...player,
      auth: authData.auth,
      conn: authData.conn,
      kickPosition
    };
    this.rm.lastBallToucher = playerData;
    this.rm.state.recordBallTouch(player.id, {
      auth: authData.auth,
      team: player.team,
      name: player.name
    });

    this.maxBallSpeed = 0;
  },

  calculateBallSpeed() {
    try {
      const speed = this.maxBallSpeed || 0;
      if (typeof speed !== 'number' || isNaN(speed) || speed === 0) return 0;
      const kmh = Math.round(speed * 13.5);
      return Math.min(kmh, 200);
    } catch (e) {
      return 0;
    }
  },

  async onTeamGoal(team) {
    if (this.rm.state.currentMap !== MAPS.V2 && this.rm.state.currentMap !== MAPS.V3) return;

    const ballSpeed = this.calculateBallSpeed();
    const lastToucher = this.rm.lastBallToucher;

    if (!lastToucher || !lastToucher.auth) return;
    if (lastToucher.team === undefined || lastToucher.team === null) return;

    const scorerTeam = lastToucher.team;
    const isOwnGoal = scorerTeam !== team && scorerTeam !== Team.SPECTATORS;

    const players = this.rm.getRealPlayers();
    const scorer = players.find(p => p.id === lastToucher.id);
    if (!scorer) return;

    const scorerAuth = lastToucher.auth;

    let assister = null;
    let assisterAuth = null;
    if (!isOwnGoal) {
      const assistCandidate = this.rm.state.getAssistCandidate(scorer.id, scorerTeam);
      if (assistCandidate) {
        assister = players.find(p => p.id === assistCandidate.playerId);
        assisterAuth = assistCandidate.auth;
      }
    }

    this.rm.recordGoal(scorerAuth, assisterAuth, isOwnGoal);

    let scorerUserId = this.rm.authManager?.getLoggedInUser(scorer.id)?.userId;
    if (!scorerUserId && scorerAuth) {
      const u = await db.get('SELECT id FROM users WHERE auth = ?', [scorerAuth]);
      scorerUserId = u?.id || null;
    }
    let assisterUserId = assister ? this.rm.authManager?.getLoggedInUser(assister.id)?.userId : null;
    if (!assisterUserId && assisterAuth) {
      const u = await db.get('SELECT id FROM users WHERE auth = ?', [assisterAuth]);
      assisterUserId = u?.id || null;
    }

    const scorerIsVip = await this.isPlayerVip(scorerAuth);

    const redCount = players.filter(p => p.team === Team.RED).length;
    const blueCount = players.filter(p => p.team === Team.BLUE).length;
    const isFullMatch = redCount >= 2 && blueCount >= 2;

    if (isOwnGoal) {
      if (scorerUserId && isFullMatch) {
        await this.rm.statsManager.recordOwnGoal(scorerUserId);
      }
      const newRadius = this.rm.state.setOwnGoalRadius(scorer.id);
      try {
        this.rm.room.setPlayerDiscProperties(scorer.id, { radius: newRadius });
      } catch (e) {}
    } else {
      if (scorerUserId && isFullMatch) {
        await this.rm.statsManager.recordGoal(scorerUserId);
      }
      if (assisterUserId && isFullMatch) {
        await this.rm.statsManager.recordAssist(assisterUserId);
      }
      if (scorerIsVip) {
        const vipSettings = await this.getVipSettings(scorerAuth);
        const charCelebEnabled = !vipSettings || vipSettings.goal_celebration !== 0;
        const goalEffectEnabled = !vipSettings || vipSettings.goal_effect_enabled !== 0;

        if (charCelebEnabled || goalEffectEnabled) {
          if (charCelebEnabled) {
            const newRadius = this.rm.state.setGoalRadius(scorer.id);
            try {
              this.rm.room.setPlayerDiscProperties(scorer.id, { radius: newRadius });
            } catch (e) {}
          }

          const celebType = charCelebEnabled ? (vipSettings?.celebration_type || 'spinning') : null;
          const goalEffectType = goalEffectEnabled ? (vipSettings?.goal_effect_type || 'goal_burst') : null;

          let ballPos = null;
          if (goalEffectEnabled) {
            try {
              const ball = this.rm.room.getDiscProperties(0);
              if (ball) ballPos = { x: ball.x, y: ball.y };
            } catch (e) {}
          }

          let goalText = null;
          if (goalEffectType === 'goal_text' && this.rm.playerCommands) {
            goalText = vipSettings?.goal_text_message || await this.rm.playerCommands.getCelebration(scorerAuth) || 'GOL!';
          }

          this.stopCelebration();
          if (charCelebEnabled) {
            this.startCelebration(scorer.id, scorerTeam, celebType, ballPos, goalEffectType || 'none', goalText);
          } else if (goalEffectEnabled && ballPos) {
            this.startCelebration(scorer.id, scorerTeam, 'none', ballPos, goalEffectType, goalText);
          }
        }
      }
    }

    let shotDistance = 0;
    if (!isOwnGoal && lastToucher?.kickPosition) {
      try {
        const pos = lastToucher.kickPosition;
        const goalX = team === Team.RED
          ? (this.rm.state.currentMap === MAPS.V3 ? 555 : 405)
          : (this.rm.state.currentMap === MAPS.V3 ? -555 : -405);
        const dx = pos.x - goalX;
        const dy = pos.y;
        const distPixels = Math.sqrt(dx * dx + dy * dy);
        const pitchLength = this.rm.state.currentMap === MAPS.V3 ? 1110 : 810;
        shotDistance = Math.round((distPixels / pitchLength) * 40);
      } catch (e) {}
    }

    const currentScores = this.rm.room.getScores();
    this.rm.logger.goal(team, scorer.name, assister ? assister.name : null, isOwnGoal, currentScores);
    this.rm.recordRecentGoal?.({
      scorer: scorer.name,
      scorerId: scorer.id,
      team,
      isOwnGoal,
      red: currentScores?.red ?? null,
      blue: currentScores?.blue ?? null,
      time: currentScores?.time ?? null
    });

    if (this.rm.matchGoalEvents) {
      this.rm.matchGoalEvents.push({
        scorerAuth,
        scorerName: scorer.name,
        assisterAuth: assisterAuth || null,
        assisterName: assister ? assister.name : null,
        team: team === Team.RED ? 'red' : 'blue',
        minute: currentScores?.time ? Math.floor(currentScores.time / 60) + (currentScores.time % 60) / 100 : 0,
        isOwnGoal: isOwnGoal ? 1 : 0,
        redScore: currentScores?.red ?? 0,
        blueScore: currentScores?.blue ?? 0
      });
    }

    this.rm.state.recordPlayerGoal(scorerAuth, isOwnGoal);

    const conceedingTeam = team === Team.RED ? 'blue' : 'red';
    this.rm.state.recordGoalConceded(conceedingTeam);

    const gameTime = currentScores ? this.formatGameTime(currentScores.time) : '';
    const rankEmoji = await this.getPlayerRankEmoji(scorerAuth);

    const teamEmoji = scorerTeam === Team.RED ? '🔴' : '🔵';

    if (isOwnGoal) {
      const goalMsg = `⚽ 𝙂𝙊𝙊𝙊𝙇! ${teamEmoji} ${rankEmoji} ${scorer.name} Kendi kalesine ${gameTime}`;
      this.rm.room.sendAnnouncement(goalMsg, null, 0xFF6600, 'bold', 1);
    } else {
      const speedText = ballSpeed > 0 ? `💨${ballSpeed} ᴋᴍ/s` : '';

      const distText = shotDistance > 0 ? `📏${shotDistance}m` : '';
      let goalMsg = `⚽ 𝙂𝙊𝙊𝙊𝙇! ${teamEmoji} ${rankEmoji} ${scorer.name}`;
      if (assister) {
        const assisterRank = await this.getPlayerRankEmoji(assisterAuth);
        goalMsg += ` (${assisterRank} ${assister.name} asist)`;
      }
      goalMsg += ` ⌛${gameTime} ${speedText} ${distText}`.trimEnd();

      const teamColor = team === Team.RED ? 0xE56E56 : 0x5689E5;
      this.rm.room.sendAnnouncement(goalMsg, null, teamColor, 'bold', 1);

      if (this.rm.playerCommands) {
        const celebration = await this.rm.playerCommands.getCelebration(scorerAuth);
        if (celebration) {
          const chatStyle = await this.getPlayerChatStyle(scorerAuth);
          this.rm.room.sendAnnouncement(
            `${chatStyle.prefix} ${scorer.name}: ${celebration}`,
            null, chatStyle.color || 0xFFD700, chatStyle.font || 'normal', 1
          );
        }
      }
    }

    this.rm.lastBallToucher = null;
  },

  onGameTick() {
    if (!this.rm.state.gameInProgress) return;

    this.rm.gameFlow.updateGameTick();
    this.tickCounter++;

    if (this.activeCelebration) {
      this.updateCelebration();
    }
    if (this.activeGoalText) {
      this._updateGoalText();
    }

    try {
      const ball = this.rm.room.getDiscProperties(0);
      if (!ball) return;

      const xspeed = ball.xspeed || 0;
      const yspeed = ball.yspeed || 0;
      const currentSpeed = Math.sqrt(xspeed * xspeed + yspeed * yspeed);

      if (currentSpeed > this.maxBallSpeed) {
        this.maxBallSpeed = currentSpeed;
      }

      if (this.tickCounter % 6 === 0) {
        this._detectGoalkeeperSave(ball, currentSpeed);
      }

      if (currentSpeed < 4 && this.tickCounter % 10 === 0) {
        const players = this.rm.getRealPlayers();
        let closestPlayer = null;
        let minDist = 25;

        for (const p of players) {
          if (p.team !== Team.RED && p.team !== Team.BLUE) continue;
          const player = this.rm.room.getPlayer(p.id);
          if (!player || !player.position) continue;

          const dx = ball.x - player.position.x;
          const dy = ball.y - player.position.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < minDist) {
            minDist = dist;
            closestPlayer = p;
          }
        }

        if (closestPlayer && minDist < 25) {
          const authData = this.rm.getPlayerAuthData(closestPlayer.id);
          if (authData) {
            this.rm.lastBallToucher = {
              ...closestPlayer,
              auth: authData.auth,
              conn: authData.conn
            };
          }
        }
      }
    } catch (e) {
      console.error('Game tick error:', e.message);
    }
  },

  _detectGoalkeeperSave(ball, speed) {
    if (speed < 3) {
      this._ballWasHeadingToGoal = null;
      return;
    }

    const bx = ball.x;
    const by = ball.y;
    const vx = ball.xspeed || 0;

    const redGoalX = this.rm.state.currentMap === MAPS.V3 ? -555 : -405;
    const blueGoalX = this.rm.state.currentMap === MAPS.V3 ? 555 : 405;
    const goalHalfY = this.rm.state.currentMap === MAPS.V3 ? 80 : 70;

    let targetTeam = null;
    if (vx < -3 && bx < redGoalX + 200 && Math.abs(by) < goalHalfY + 30) {
      targetTeam = 'red';
    } else if (vx > 3 && bx > blueGoalX - 200 && Math.abs(by) < goalHalfY + 30) {
      targetTeam = 'blue';
    }

    if (targetTeam) {
      this._ballWasHeadingToGoal = targetTeam;
    } else if (this._ballWasHeadingToGoal && speed < 3) {
      const gk = this.rm.state.getGoalkeeper(this._ballWasHeadingToGoal);
      if (gk) {
        try {
          const gkPlayer = this.rm.room.getPlayer(gk.id);
          if (gkPlayer?.position) {
            const dx = ball.x - gkPlayer.position.x;
            const dy = ball.y - gkPlayer.position.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 60) {
              this.rm.state.recordGoalkeeperSave(this._ballWasHeadingToGoal);
            }
          }
        } catch (e) {}
      }
      this._ballWasHeadingToGoal = null;
    }
  },

  onPlayerActivity(player) {
    if (!player) return;

    if (player.team === Team.RED || player.team === Team.BLUE) {
      this.rm.playerActivity.update(player.id);
      this.rm.gameFlow.clearPlayerWarning(player.id);
    }
  },

  async isPlayerVip(auth) {
    if (!auth) return false;
    const user = await db.get('SELECT allowed_room, is_admin FROM users WHERE auth = ?', [auth]);
    return user?.is_admin === 1 || user?.allowed_room === 'vip';
  },

  async getVipSettings(auth) {
    if (!auth) return null;
    return await db.get('SELECT goal_celebration, goal_effect_enabled, celebration_type, goal_effect_type, goal_text_message, animated_avatar, avatar_speed FROM vip_settings WHERE auth = ?', [auth]);
  },
};
