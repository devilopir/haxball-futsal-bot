const { Team } = require('../../utils/constants');
const MAPS = require('../../../maps');
const config = require('../../../config');
const db = require('../../database/Database');

module.exports = {
  async showMatchStats(redPlayers, bluePlayers, scores) {
    const ballTouches = this.rm.state.getAllBallTouches();

    let totalTouches = 0;
    let redTouches = 0;
    let blueTouches = 0;
    const playerTouches = [];

    for (const player of redPlayers) {
      const touches = ballTouches.get(player.id) || 0;
      totalTouches += touches;
      redTouches += touches;
      playerTouches.push({ player, touches });
    }
    for (const player of bluePlayers) {
      const touches = ballTouches.get(player.id) || 0;
      totalTouches += touches;
      blueTouches += touches;
      playerTouches.push({ player, touches });
    }

    const redPossession = totalTouches > 0 ? Math.round((redTouches / totalTouches) * 100) : 50;
    const bluePossession = totalTouches > 0 ? 100 - redPossession : 50;

    const getPlayerStats = async (players) => {
      const stats = [];
      const processedAuths = new Set();
      for (const player of players) {
        const auth = this.rm.getPlayerAuthData(player.id)?.auth;
        if (!auth || processedAuths.has(auth)) continue;
        processedAuths.add(auth);

        const playerStat = this.rm.matchStats.get(auth);
        if (!playerStat) continue;

        const goals = playerStat.goals || 0;
        const assists = playerStat.assists || 0;
        const ownGoals = playerStat.ownGoals || 0;

        if (goals > 0 || assists > 0 || ownGoals > 0) {
          let statParts = [];
          if (goals > 0) statParts.push(`${goals}G`);
          if (assists > 0) statParts.push(`${assists}A`);
          if (ownGoals > 0) statParts.push(`${ownGoals}KK`);
          const badge = await this.getPlayerRankEmoji(auth);
          stats.push(`${badge} ${player.name} ${statParts.join('/')}`);
        }
      }
      return stats;
    };

    const redStats = await getPlayerStats(redPlayers);
    const blueStats = await getPlayerStats(bluePlayers);

    const calculateMVPScore = (player, touches, winningTeam) => {
      const auth = this.rm.getPlayerAuthData(player.id)?.auth;
      if (!auth) return 0;

      const matchStat = this.rm.matchStats.get(auth);
      if (!matchStat) return touches * 0.1;

      let score = 0;
      score += (matchStat.goals || 0) * 10;
      score += (matchStat.assists || 0) * 5;
      score -= (matchStat.ownGoals || 0) * 5;
      score += touches * 0.1;

      if (player.team === winningTeam) {
        score += 5;
      }

      return score;
    };

    let mvpName = null;
    const isAtLeast2v2 = redPlayers.length >= 2 && bluePlayers.length >= 2;
    if (totalTouches > 0 && isAtLeast2v2) {
      const winningTeam = scores.red > scores.blue ? Team.RED : Team.BLUE;

      const playerScores = playerTouches.map(pt => ({
        player: pt.player,
        score: calculateMVPScore(pt.player, pt.touches, winningTeam)
      }));

      playerScores.sort((a, b) => b.score - a.score);
      const mvp = playerScores[0];
      if (mvp && mvp.score > 0) {
        const mvpAuth = this.rm.getPlayerAuthData(mvp.player.id)?.auth;
        const mvpBadge = await this.getPlayerRankEmoji(mvpAuth);
        mvpName = `${mvpBadge} ${mvp.player.name}`;
      }
    }

    const winner = scores.red > scores.blue ? 'Kırmızı' : 'Mavi';
    const emoji = winner === 'Kırmızı' ? '🔴' : '🔵';
    const winnerColor = winner === 'Kırmızı' ? 0xE56E56 : 0x5689E5;

    this.rm.room.sendAnnouncement(
      `🏆 ${emoji} ${winner.toUpperCase()} KAZANDI! [${scores.red}-${scores.blue}]`,
      null, winnerColor, 'bold', 2
    );

    this.rm.room.sendAnnouncement(
      `⚽ Top: 🔴 %${redPossession} - %${bluePossession} 🔵`,
      null, 0xAAAAAA, 'normal', 0
    );
    if (redStats.length > 0) {
      this.rm.room.sendAnnouncement(
        `🔴 ${redStats.join(' | ')}`,
        null, 0xE56E56, 'normal', 0
      );
    }
    if (blueStats.length > 0) {
      this.rm.room.sendAnnouncement(
        `🔵 ${blueStats.join(' | ')}`,
        null, 0x5689E5, 'normal', 0
      );
    }
    if (mvpName) {
      this.rm.room.sendAnnouncement(
        `⭐ MVP: ${mvpName}`,
        null, 0xFFD700, 'bold', 1
      );
    }

    const redSaves = this.rm.state.getGoalkeeperSaves('red');
    const blueSaves = this.rm.state.getGoalkeeperSaves('blue');
    if (redSaves > 0 || blueSaves > 0) {
      const redGK = this.rm.state.getGoalkeeper('red');
      const blueGK = this.rm.state.getGoalkeeper('blue');
      const parts = [];
      if (redGK && redSaves > 0) parts.push(`🔴 ${redGK.name} ${redSaves} kurtarış`);
      if (blueGK && blueSaves > 0) parts.push(`🔵 ${blueGK.name} ${blueSaves} kurtarış`);
      if (parts.length > 0) {
        this.rm.room.sendAnnouncement(`🧤 ${parts.join(' | ')}`, null, 0xAAAAAA, 'normal', 0);
      }
    }

    try {
      const winnerTeam = scores.red > scores.blue ? 'red' : 'blue';
      const streak = this.rm.state.getTeamStreak(winnerTeam)?.wins || 0;
      if (streak >= 1) {
        const teamEmoji = winnerTeam === 'red' ? '🔴' : '🔵';
        const teamName = winnerTeam === 'red' ? 'RED' : 'BLUE';
        this.rm.room.sendAnnouncement(
          `🔥 ${teamEmoji} ${teamName} ${streak} maçtır kaybetmiyor!`,
          null, 0xFFD700, 'bold', 1
        );
      }
    } catch (e) {
      console.error('[STREAK] Error:', e.message);
    }
  },

  async updatePersistentStats(redPlayers, bluePlayers, winner, scores) {
    if (!this.rm.authManager) return;

    const allPlayers = [...redPlayers, ...bluePlayers];
    const winners = winner === 'red' ? redPlayers : winner === 'blue' ? bluePlayers : [];
    const losers = winner === 'red' ? bluePlayers : winner === 'blue' ? redPlayers : [];

    const getLoggedInUserId = async (playerId) => {
      const loggedIn = this.rm.authManager.getLoggedInUser(playerId);
      if (loggedIn?.userId) return loggedIn.userId;
      const authData = this.rm.getPlayerAuthData(playerId);
      if (!authData?.auth) return null;
      const user = await db.get('SELECT id FROM users WHERE auth = ?', [authData.auth]);
      return user?.id || null;
    };

    for (const player of winners) {
      const userId = await getLoggedInUserId(player.id);
      if (userId) {
        await this.rm.statsManager.recordMatch(userId, true);
      }
    }

    for (const player of losers) {
      const userId = await getLoggedInUserId(player.id);
      if (userId) {
        await this.rm.statsManager.recordMatch(userId, false);
      }
    }

    if (winner === 'red' && scores && scores.blue === 0) {
      for (const player of winners) {
        const userId = await getLoggedInUserId(player.id);
        if (userId) {
          await this.rm.statsManager.recordCleanSheet(userId);
        }
      }
    } else if (winner === 'blue' && scores && scores.red === 0) {
      for (const player of winners) {
        const userId = await getLoggedInUserId(player.id);
        if (userId) {
          await this.rm.statsManager.recordCleanSheet(userId);
        }
      }
    }

    if (winner !== 'draw') {
      const ballTouches = this.rm.state.getAllBallTouches();
      const winningTeam = winner === 'red' ? Team.RED : Team.BLUE;

      let mvpPlayer = null;
      let maxScore = 0;

      for (const player of allPlayers) {
        const touches = ballTouches.get(player.id) || 0;
        const auth = this.rm.getPlayerAuthData(player.id)?.auth;
        if (!auth) continue;

        const matchStat = this.rm.matchStats.get(auth);
        let score = touches * 0.1;

        if (matchStat) {
          score += (matchStat.goals || 0) * 10;
          score += (matchStat.assists || 0) * 5;
          score -= (matchStat.ownGoals || 0) * 5;
        }

        if (player.team === winningTeam) {
          score += 5;
        }

        if (score > maxScore) {
          maxScore = score;
          mvpPlayer = player;
        }
      }

      if (mvpPlayer && maxScore > 0) {
        const mvpUserId = await getLoggedInUserId(mvpPlayer.id);
        if (mvpUserId) {
          await this.rm.statsManager.recordMVP(mvpUserId);
        }
      }
    }

    for (const player of allPlayers) {
      const userId = await getLoggedInUserId(player.id);
      if (userId) {
        const auth = this.rm.getPlayerAuthData(player.id)?.auth;
        const matchStat = this.rm.matchStats.get(auth);
        if (matchStat && matchStat.goals >= 3) {
          await this.rm.statsManager.recordHatTrick(userId);
        }
      }
    }

    await this._checkAchievements(allPlayers, winners, getLoggedInUserId);
  },

  updatePlayerWinStreaks(redPlayers, bluePlayers, winner) {
    const winners = winner === 'red' ? redPlayers : winner === 'blue' ? bluePlayers : [];
    const losers = winner === 'red' ? bluePlayers : winner === 'blue' ? redPlayers : [];

    for (const player of winners) {
      const auth = this.rm.getPlayerAuthData(player.id)?.auth;
      if (auth) {
        this.rm.state.recordPlayerMatchResult(auth, true);
      }
    }

    for (const player of losers) {
      const auth = this.rm.getPlayerAuthData(player.id)?.auth;
      if (auth) {
        this.rm.state.recordPlayerMatchResult(auth, false);
      }
    }

    if (winner === 'draw') {
      for (const player of [...redPlayers, ...bluePlayers]) {
        const auth = this.rm.getPlayerAuthData(player.id)?.auth;
        if (auth) {
          const current = this.rm.state.getPlayerWinStreak(auth);
          if (current && current.wins > 0) {
            this.rm.state.playerWinStreaks.set(auth, { wins: current.wins, losses: 0 });
          }
        }
      }
    }
  },

  async _sendReplay(scores, winner, redPlayers, bluePlayers) {
    try {
      const recording = this.rm.room.stopRecording();
      if (!recording) return;
      const roomName = config.roomConfig?.roomName || 'Oda';
      const now = new Date();
      const dateStr = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const fileName = `${config.botId}_${scores.red}-${scores.blue}_${dateStr}.hbr`;

      const redNames = redPlayers.map(p => p.name).join(', ');
      const blueNames = bluePlayers.map(p => p.name).join(', ');

      const redAuths = redPlayers.map(p => this.rm.getPlayerAuthData(p.id)?.auth || '').filter(a => a);
      const blueAuths = bluePlayers.map(p => this.rm.getPlayerAuthData(p.id)?.auth || '').filter(a => a);

      let mapName = 'Bilinmiyor';
      if (this.rm.state.currentMap === MAPS.V3) mapName = 'V3';
      else if (this.rm.state.currentMap === MAPS.V2) mapName = 'V2';

      const recBuf = Buffer.isBuffer(recording) ? recording : Buffer.from(recording);

      try {
        const result = await db.runReturning(
          `INSERT INTO match_replays (bot_id, room_name, map_name, red_score, blue_score, winner, red_players, blue_players, red_auths, blue_auths, replay_url, file_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [config.botId, roomName, mapName, scores.red, scores.blue, winner, redNames, blueNames, JSON.stringify(redAuths), JSON.stringify(blueAuths), '', fileName]
        );
        const matchId = result?.lastInsertRowid;
        if (matchId) {
          await this._saveMatchDetails(matchId, redPlayers, bluePlayers, winner, scores);
        }
      } catch (e) {}
    } catch (e) {
      console.error('[Replay] Replay kayit hatasi:', e.message);
    }
  },

  async _saveMatchDetails(matchId, redPlayers, bluePlayers, winner, scores) {
    try {
      const ballTouches = this.rm.state.getAllBallTouches();
      const allPlayers = [...redPlayers, ...bluePlayers];
      const winningTeam = winner === 'red' ? Team.RED : winner === 'blue' ? Team.BLUE : 0;

      let mvpPlayer = null;
      let maxScore = 0;

      const playerDataList = [];
      for (const player of allPlayers) {
        const auth = this.rm.getPlayerAuthData(player.id)?.auth;
        if (!auth) continue;
        const matchStat = this.rm.matchStats.get(auth);
        const touches = ballTouches.get(player.id) || 0;
        const team = player.team === Team.RED ? 'red' : 'blue';

        let mvpScore = touches * 0.1;
        if (matchStat) {
          mvpScore += (matchStat.goals || 0) * 10;
          mvpScore += (matchStat.assists || 0) * 5;
          mvpScore -= (matchStat.ownGoals || 0) * 5;
        }
        if (player.team === winningTeam) mvpScore += 5;

        if (mvpScore > maxScore) {
          maxScore = mvpScore;
          mvpPlayer = auth;
        }

        playerDataList.push({
          auth,
          nickname: player.name,
          team,
          goals: matchStat?.goals || 0,
          assists: matchStat?.assists || 0,
          ownGoals: matchStat?.ownGoals || 0,
          touches
        });
      }

      for (const p of playerDataList) {
        await db.run(
          `INSERT INTO match_player_stats (match_id, auth, nickname, team, goals, assists, own_goals, touches, is_mvp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [matchId, p.auth, p.nickname, p.team, p.goals, p.assists, p.ownGoals, p.touches, p.auth === mvpPlayer ? 1 : 0]
        );
      }

      const goalEvents = this.rm.matchGoalEvents || [];
      if (goalEvents.length > 0) {
        for (const g of goalEvents) {
          await db.run(
            `INSERT INTO goal_events (match_id, scorer_auth, scorer_name, assister_auth, assister_name, team, minute, is_own_goal, red_score, blue_score) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [matchId, g.scorerAuth, g.scorerName, g.assisterAuth, g.assisterName, g.team, g.minute, g.isOwnGoal, g.redScore, g.blueScore]
          );
        }
      }

      await this._saveDailyStats(playerDataList, winner, mvpPlayer);
    } catch (e) {
      console.error('[MatchDetails] Kayıt hatası:', e.message);
    }
  },

  async _saveDailyStats(playerDataList, winner, mvpAuth) {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const POINTS = { WIN: 10, LOSS: -5, GOAL: 3, ASSIST: 2, OWN_GOAL: -8, MVP: 5 };

      for (const p of playerDataList) {
        const won = (winner === p.team);
        let pointsEarned = won ? POINTS.WIN : (winner === 'draw' ? 0 : POINTS.LOSS);
        pointsEarned += p.goals * POINTS.GOAL;
        pointsEarned += p.assists * POINTS.ASSIST;
        pointsEarned += p.ownGoals * POINTS.OWN_GOAL;
        if (p.auth === mvpAuth) pointsEarned += POINTS.MVP;

        const existing = await db.get('SELECT id FROM daily_stats WHERE auth = ? AND date = ?', [p.auth, today]);
        if (existing) {
          await db.run(
            `UPDATE daily_stats SET points_earned = points_earned + ?, goals = goals + ?, assists = assists + ?, wins = wins + ?, matches = matches + 1, mvp_count = mvp_count + ? WHERE id = ?`,
            [pointsEarned, p.goals, p.assists, won ? 1 : 0, p.auth === mvpAuth ? 1 : 0, existing.id]
          );
        } else {
          await db.run(
            `INSERT INTO daily_stats (auth, nickname, date, points_earned, goals, assists, wins, matches, mvp_count) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
            [p.auth, p.nickname, today, pointsEarned, p.goals, p.assists, won ? 1 : 0, p.auth === mvpAuth ? 1 : 0]
          );
        }
      }
    } catch (e) {
      console.error('[DailyStats] Kayıt hatası:', e.message);
    }
  },

  async _checkAchievements(allPlayers, winners, getLoggedInUserId) {
    try {
      const ACHIEVEMENT_DEFS = [
        { type: 'first_goal', check: s => s.goals >= 1 },
        { type: 'goals_50', check: s => s.goals >= 50 },
        { type: 'goals_100', check: s => s.goals >= 100 },
        { type: 'goals_500', check: s => s.goals >= 500 },
        { type: 'assists_50', check: s => s.assists >= 50 },
        { type: 'assists_100', check: s => s.assists >= 100 },
        { type: 'matches_50', check: s => s.matches >= 50 },
        { type: 'matches_100', check: s => s.matches >= 100 },
        { type: 'matches_500', check: s => s.matches >= 500 },
        { type: 'wins_50', check: s => s.wins >= 50 },
        { type: 'wins_100', check: s => s.wins >= 100 },
        { type: 'mvp_10', check: s => s.mvp_count >= 10 },
        { type: 'mvp_50', check: s => s.mvp_count >= 50 },
        { type: 'clean_sheet_10', check: s => s.clean_sheets >= 10 },
        { type: 'hat_trick_king', check: s => s.hat_tricks >= 10 },
        { type: 'streak_5', check: s => s.best_win_streak >= 5 },
        { type: 'streak_10', check: s => s.best_win_streak >= 10 },
        { type: 'points_1000', check: s => s.points >= 1000 },
        { type: 'points_3000', check: s => s.points >= 3000 },
        { type: 'points_5000', check: s => s.points >= 5000 },
      ];

      for (const player of allPlayers) {
        const auth = this.rm.getPlayerAuthData(player.id)?.auth;
        if (!auth) continue;

        const userId = await getLoggedInUserId(player.id);
        if (!userId) continue;

        const stats = await db.get('SELECT * FROM stats WHERE user_id = ?', [userId]);
        if (!stats) continue;

        const existingAchievements = await db.all('SELECT type FROM achievements WHERE auth = ?', [auth]);
        const existingSet = new Set(existingAchievements.map(a => a.type));
        const isBackfill = existingSet.size === 0 && stats.matches > 3;

        const newAchievements = [];
        for (const def of ACHIEVEMENT_DEFS) {
          if (existingSet.has(def.type)) continue;
          if (def.check(stats)) {
            await db.run('INSERT INTO achievements (auth, type) VALUES (?, ?)', [auth, def.type]);
            newAchievements.push(def.type);
          }
        }

        if (!isBackfill) {
          for (const type of newAchievements) {
            this._announceAchievement(player.name, type);
          }
        }
      }
    } catch (e) {
      console.error('[Achievements] Kontrol hatası:', e.message);
    }
  },

  _announceAchievement(playerName, type) {
    const LABELS = {
      first_goal: 'İlk Gol!',
      goals_50: '50 Gol',
      goals_100: '100 Gol',
      goals_500: '500 Gol',
      assists_50: '50 Asist',
      assists_100: '100 Asist',
      matches_50: '50 Maç',
      matches_100: '100 Maç',
      matches_500: '500 Maç',
      wins_50: '50 Galibiyet',
      wins_100: '100 Galibiyet',
      mvp_10: '10 MVP',
      mvp_50: '50 MVP',
      clean_sheet_10: '10 Clean Sheet',
      hat_trick_king: 'Hat-trick Kralı',
      streak_5: '5 Seri Galibiyet',
      streak_10: '10 Seri Galibiyet',
      points_1000: '1000 Puan',
      points_3000: '3000 Puan',
      points_5000: '5000 Puan',
    };
    const label = LABELS[type] || type;
    try {
      this.rm.room.sendAnnouncement(
        `🏆 ${playerName} "${label}" başarımını açtı!`,
        null, 0xFFD700, 'bold', 1
      );
    } catch (e) {}
  },
};
