const fs = require('fs');
const path = require('path');

class LogManager {
  constructor(logDir = 'logs') {
    this.logDir = logDir;
    this.recent = [];
    this.ensureLogDir();
  }

  ensureLogDir() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  getLogFileName() {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    return path.join(this.logDir, `room-${dateStr}.log`);
  }

  formatTimestamp() {
    const now = new Date();
    return now.toLocaleString('tr-TR', {
      timeZone: 'Europe/Istanbul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  log(eventType, data) {
    const timestamp = this.formatTimestamp();
    const logEntry = `[${timestamp}] [${eventType}] ${JSON.stringify(data)}\n`;

    try {
      fs.appendFileSync(this.getLogFileName(), logEntry);
    } catch (error) {
      console.error('Log yazma hatasi:', error.message);
    }

    try {
      this.recent.push({ ts: Date.now(), eventType, data });
      if (this.recent.length > 400) this.recent.shift();
    } catch (e) {}
  }

  getRecent(maxEntries = 200) {
    const n = Number(maxEntries) || 0;
    if (n <= 0) return [];
    return this.recent.slice(-n);
  }

  playerJoin(player, auth) {
    this.log('PLAYER_JOIN', {
      id: player.id,
      name: player.name,
      auth: auth ? auth.substring(0, 8) + '...' : 'N/A'
    });
  }

  playerLeave(player) {
    this.log('PLAYER_LEAVE', {
      id: player.id,
      name: player.name,
      team: this.teamName(player.team)
    });
  }

  playerTeamChange(player, byPlayer) {
    this.log('TEAM_CHANGE', {
      player: player.name,
      newTeam: this.teamName(player.team),
      byPlayer: byPlayer ? byPlayer.name : 'System'
    });
  }

  gameStart() {
    this.log('GAME_START', { status: 'started' });
  }

  gameStop(byPlayer) {
    this.log('GAME_STOP', {
      stoppedBy: byPlayer ? byPlayer.name : 'System'
    });
  }

  goal(team, scorer, assist, isOwnGoal, scores) {
    this.log('GOAL', {
      team: this.teamName(team),
      scorer: scorer || 'Unknown',
      assist: assist || null,
      isOwnGoal: isOwnGoal,
      redScore: scores.red,
      blueScore: scores.blue
    });
  }

  teamVictory(winningTeam, scores) {
    this.log('MATCH_END', {
      winner: this.teamName(winningTeam),
      redScore: scores.red,
      blueScore: scores.blue
    });
  }

  chat(player, message) {
    this.log('CHAT', {
      player: player.name,
      message: message
    });
  }

  command(player, command, args) {
    this.log('COMMAND', {
      player: player.name,
      command: command,
      args: args
    });
  }

  kick(player, reason, ban) {
    this.log('KICK', {
      player: player.name,
      reason: reason,
      banned: ban
    });
  }

  afkChange(player, isAfk) {
    this.log('AFK', {
      player: player.name,
      status: isAfk ? 'AFK' : 'Active'
    });
  }

  captainSelection(captain, action, selectedPlayer = null) {
    this.log('CAPTAIN', {
      captain: captain.name,
      action: action,
      selectedPlayer: selectedPlayer ? selectedPlayer.name : null
    });
  }

  aiDecision(stage, model, context, decision) {
    const suspects = Array.isArray(decision?.suspects) ? decision.suspects : [];
    const questions = Array.isArray(decision?.questions) ? decision.questions : [];
    const safeCtx = {
      room: context?.room || null,
      reporter: context?.reporter || null,
      scores: context?.scores || null
    };
    this.log('AI_DECISION', {
      stage,
      model: model || null,
      context: safeCtx,
      summary: decision?.summary || '',
      suspects: suspects.slice(0, 20),
      questions: questions.slice(0, 20)
    });
  }

  aiActions(stage, model, context, applied, skipped) {
    const safeCtx = {
      room: context?.room || null,
      reporter: context?.reporter || null,
      scores: context?.scores || null
    };
    this.log('AI_ACTIONS', {
      stage,
      model: model || null,
      context: safeCtx,
      applied: Array.isArray(applied) ? applied : [],
      skipped: Array.isArray(skipped) ? skipped : []
    });
  }

  mapChange(mapName) {
    this.log('MAP_CHANGE', {
      map: mapName
    });
  }

  rotation(event, data = {}) {
    this.log('ROTATION', { event, ...data });
  }

  balance(event, data = {}) {
    this.log('BALANCE', { event, ...data });
  }

  watchdog(problem, data = {}) {
    this.log('WATCHDOG', { problem, ...data });
  }

  teamName(teamId) {
    switch(teamId) {
      case 1: return 'Red';
      case 2: return 'Blue';
      default: return 'Spectator';
    }
  }
}

module.exports = LogManager;
