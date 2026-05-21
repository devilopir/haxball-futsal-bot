const config = require('../../config');
const db = require('../database/Database');

class RoomSyncManager {
  constructor(roomManager) {
    this.rm = roomManager;
    this.isMasterBot = config.botId === 'bot1';
  }

  start() {
    this.updateRoomStatus();
    this.roomStatusInterval = setInterval(() => this.updateRoomStatus(), 5000);
    this.commandCheckInterval = setInterval(() => this.checkPendingCommands(), 2000);
  }

  async updateRoomStatus() {
    try {
      if (!this.rm?.room) return;
      const players = this.rm.getRealPlayers() || [];
      const playersJson = JSON.stringify(players.map(p => {
        const authData = this.rm.getPlayerAuthData(p.id);
        return { name: p.name, team: p.team, id: p.id, auth: authData?.auth || p.auth || null };
      }));
      const roomLink = this.rm?.roomLink || '';

      await db.run(
        `INSERT INTO room_status (bot_id, room_name, room_link, players, total, red, blue, spec, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (bot_id) DO UPDATE SET room_name = EXCLUDED.room_name, room_link = EXCLUDED.room_link, players = EXCLUDED.players, total = EXCLUDED.total, red = EXCLUDED.red, blue = EXCLUDED.blue, spec = EXCLUDED.spec, updated_at = EXCLUDED.updated_at`,
        [
          config.botId,
          config.roomConfig.roomName,
          roomLink,
          playersJson,
          players.length,
          players.filter(p => p.team === 1).length,
          players.filter(p => p.team === 2).length,
          players.filter(p => p.team === 0).length,
          Date.now()
        ]
      );
    } catch (e) {
      console.error('[RoomSync] updateRoomStatus hatası:', e.message);
    }
  }

  async loadAllRoomStatus() {
    try {
      const now = Date.now();
      const rows = await db.all(`SELECT * FROM room_status WHERE updated_at > ?`, [now - 30000]);
      const active = {};
      for (const row of rows) {
        active[row.bot_id] = {
          roomName: row.room_name,
          roomLink: row.room_link || '',
          players: JSON.parse(row.players || '[]'),
          total: row.total,
          red: row.red,
          blue: row.blue,
          spec: row.spec,
          updatedAt: row.updated_at
        };
      }
      return active;
    } catch (e) {
      console.error('[RoomSync] loadAllRoomStatus hatası:', e.message);
    }
    return {};
  }

  async addPendingCommand(type, targetName, extra = {}) {
    try {
      const executedBy = extra.executedBy || [];
      await db.run(
        `INSERT INTO pending_commands (type, target_name, target_auth, target_conn, reason, message, executed_by, created_at, executed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        [
          type,
          targetName || '',
          extra.targetAuth || '',
          extra.targetConn || '',
          extra.reason || '',
          extra.message || '',
          JSON.stringify(executedBy),
          Date.now()
        ]
      );
      return true;
    } catch (e) {
      console.error('[RoomSync] addPendingCommand hatası:', e.message);
      return false;
    }
  }

  async checkPendingCommands() {
    try {
      if (!this.rm?.room) return;
      const now = Date.now();
      const commands = await db.all(`SELECT * FROM pending_commands WHERE created_at > ? AND executed = 0`, [now - 60000]);

      for (const cmd of commands) {
        let executedBy = [];
        try { executedBy = JSON.parse(cmd.executed_by || '[]'); } catch (e) {}
        if (executedBy.includes(config.botId)) continue;

        if (cmd.type === 'duyuru') {
          if (!executedBy.includes(config.botId)) {
            this.rm?.room?.sendAnnouncement(`${cmd.message}`, null, 0xFFFF00, 'bold', 2);
            executedBy.push(config.botId);
            await db.run(`UPDATE pending_commands SET executed_by = ? WHERE id = ?`, [JSON.stringify(executedBy), cmd.id]);
          }
          continue;
        }

        if (cmd.type === 'reload_announcements') {
          if (!executedBy.includes(config.botId)) {
            this.rm?.playerCommands?.startAnnouncementInterval();
            executedBy.push(config.botId);
            await db.run(`UPDATE pending_commands SET executed_by = ? WHERE id = ?`, [JSON.stringify(executedBy), cmd.id]);
          }
          continue;
        }

        const players = this.rm?.getRealPlayers() || [];
        const enriched = players.map(p => {
          const ad = this.rm?.getPlayerAuthData(p.id);
          return { ...p, auth: ad?.auth || undefined, conn: ad?.conn || undefined };
        });
        let target = null;

        const targetAuth = (cmd.target_auth || '').trim();
        const targetConn = (cmd.target_conn || '').trim();
        const targetName = (cmd.target_name || '').trim();

        if (targetAuth) {
          target = enriched.find(p => p.auth === targetAuth) || null;
        }
        if (!target && targetConn) {
          target = enriched.find(p => p.conn === targetConn) || null;
        }
        if (!target && targetName) {
          const exact = enriched.filter(p => p.name.toLowerCase() === targetName.toLowerCase());
          if (exact.length === 1) {
            target = exact[0];
          } else if (exact.length === 0) {
            const matches = enriched.filter(p => p.name.toLowerCase().includes(targetName.toLowerCase()));
            if (matches.length === 1) target = matches[0];
          }
        }

        if (!target) continue;
        await this.executeCommand(cmd, target);
        executedBy.push(config.botId);
        await db.run(`UPDATE pending_commands SET executed_by = ? WHERE id = ?`, [JSON.stringify(executedBy), cmd.id]);
      }

      await db.run(`DELETE FROM pending_commands WHERE created_at < ?`, [now - 60000]);
    } catch (e) {
      console.error('[RoomSync] checkPendingCommands hatası:', e.message);
    }
  }

  async executeCommand(cmd, target) {
    const ownerNick = config.ownerNickname;
    if (ownerNick && String(target.name || '').toLowerCase() === ownerNick.toLowerCase()) {
      return;
    }

    const authData = this.rm?.getPlayerAuthData(target.id);
    const auth = authData?.auth || cmd.target_auth || target.auth || null;
    const conn = authData?.conn || cmd.target_conn || target.conn || null;
    const roomName = config.roomConfig.roomName;

    switch (cmd.type) {
      case 'kick':
        this.rm?.safeKickPlayer(target.id, cmd.reason || 'Yönetim', false);
        this.rm?.room?.sendAnnouncement(`✅ ${target.name} atıldı.\n🏠 ${roomName}`, null, 0xFFFF00, 'bold', 1);
        break;
      case 'ban':
        await this.rm?.banManager?.ban(target.name, auth, conn, cmd.reason || 'Yönetim', 'Yönetim');
        this.rm?.safeKickPlayer(target.id, cmd.reason || 'Yönetim', false);
        this.rm?.room?.sendAnnouncement(`✅ ${target.name} banlandı.\n🏠 ${roomName}`, null, 0xFFFF00, 'bold', 1);
        break;
      case 'mute':
        if (auth) {
          const durMatch = (cmd.reason || '').match(/^duration:(\d+)$/);
          if (durMatch) {
            const durationMs = parseInt(durMatch[1]) * 60 * 1000;
            await this.rm?.playerCommands?.tempMuteAuth(auth, durationMs, 'Yönetim');
            const label = parseInt(durMatch[1]) >= 60 ? `${Math.floor(parseInt(durMatch[1]) / 60)} saat` : `${durMatch[1]} dakika`;
            this.rm?.room?.sendAnnouncement(`🔇 ${target.name} ${label} susturuldu.\n🏠 ${roomName}`, null, 0xFFFF00, 'bold', 1);
          } else {
            await this.rm?.playerCommands?.addPermanentMute(auth, target.name, 'Yönetim');
            this.rm?.room?.sendAnnouncement(`✅ ${target.name} susturuldu.\n🏠 ${roomName}`, null, 0xFFFF00, 'bold', 1);
          }
        }
        break;
      case 'unmute':
        if (auth) {
          try { await this.rm?.playerCommands?.clearTempMuteAuth?.(auth); } catch (e) {}
          await this.rm?.playerCommands?.removePermanentMute(auth);
          this.rm?.room?.sendAnnouncement(`✅ ${target.name} susturması kaldırıldı.\n🏠 ${roomName}`, null, 0xFFFF00, 'bold', 1);
        }
        break;
      case 'admin_ver': {
        await this.rm?.authManager?.setAdmin(auth, target.name);
        const loggedUser = this.rm?.authManager?.getLoggedInUser(target.id);
        if (loggedUser) loggedUser.isAdmin = true;
        this.rm?.room?.setPlayerAdmin(target.id, true);
        this.rm?.room?.sendAnnouncement(`👑 ${target.name} admin yapıldı!`, null, 0xFFD700, 'bold', 1);
        break;
      }
      case 'admin_sil': {
        await this.rm?.authManager?.removeAdmin(auth, target.name);
        const loggedUser2 = this.rm?.authManager?.getLoggedInUser(target.id);
        if (loggedUser2) loggedUser2.isAdmin = false;
        this.rm?.room?.setPlayerAdmin(target.id, false);
        this.rm?.room?.sendAnnouncement(`${target.name} admin yetkisi kaldırıldı.`, null, 0xFF6600, 'bold', 1);
        break;
      }
    }
  }

  destroy() {
    if (this.roomStatusInterval) {
      clearInterval(this.roomStatusInterval);
      this.roomStatusInterval = null;
    }
    if (this.commandCheckInterval) {
      clearInterval(this.commandCheckInterval);
      this.commandCheckInterval = null;
    }
  }
}

module.exports = RoomSyncManager;
