const { DURATIONS } = require('../utils/constants');

class PlayerActivityTracker {
  constructor() {
    this.activities = new Map();
    this.afkPlayers = new Map();
  }

  update(playerId) {
    if (playerId === undefined || playerId === null) return;
    this.activities.set(playerId, Date.now());
  }

  isAFK(playerId) {
    return this.afkPlayers.has(playerId);
  }

  setAFK(playerId, playerName) {
    if (playerId === undefined || playerId === null) return;
    this.afkPlayers.set(playerId, { matchCount: 0, name: playerName || 'Unknown' });
  }

  removeAFK(playerId) {
    this.afkPlayers.delete(playerId);
  }

  getAFKMatchCount(playerId) {
    const afkData = this.afkPlayers.get(playerId);
    return afkData ? afkData.matchCount : 0;
  }

  incrementAFKMatchCount(playerId) {
    const afkData = this.afkPlayers.get(playerId);
    if (afkData) {
      afkData.matchCount++;
      return afkData.matchCount;
    }
    return 0;
  }

  getAFKPlayers() {
    return Array.from(this.afkPlayers.entries()).map(([id, data]) => ({
      id,
      name: data.name,
      matchCount: data.matchCount
    }));
  }

  getInactiveTime(playerId) {
    const lastActivity = this.activities.get(playerId);
    if (lastActivity === undefined || lastActivity === null) return null;
    if (typeof lastActivity !== 'number' || isNaN(lastActivity)) return null;
    return Date.now() - lastActivity;
  }

  remove(playerId) {
    this.activities.delete(playerId);
    this.afkPlayers.delete(playerId);
  }

  cleanup(maxAge = DURATIONS.ACTIVITY_CLEANUP) {
    const now = Date.now();
    for (const [playerId, timestamp] of this.activities.entries()) {
      if (typeof timestamp !== 'number' || isNaN(timestamp) || now - timestamp > maxAge) {
        this.activities.delete(playerId);
      }
    }
  }

  clear() {
    this.activities.clear();
    this.afkPlayers.clear();
  }
}

module.exports = PlayerActivityTracker;
