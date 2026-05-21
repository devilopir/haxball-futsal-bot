const db = require('../database/Database');

class BanManager {
    constructor() {}

    async recordPlayer(name, auth, conn) {
        if (!name) return;

        const existing = await db.get(
            'SELECT * FROM player_history WHERE LOWER(name) = LOWER(?)',
            [name]
        );

        if (existing) {
            await db.run(
                'UPDATE player_history SET name = ?, auth = COALESCE(?, auth), conn = COALESCE(?, conn), last_seen = CURRENT_TIMESTAMP WHERE id = ?',
                [name, auth, conn, existing.id]
            );
        } else {
            await db.run(
                'INSERT INTO player_history (name, auth, conn) VALUES (?, ?, ?)',
                [name, auth, conn]
            );
        }
    }

    async ban(name, auth, conn, reason = 'Karaliste', bannedBy = null, expiresAt = null, roomType = null) {
        const existing = await db.get(
            'SELECT * FROM bans WHERE (LOWER(name) = LOWER(?) OR auth = ? OR conn = ?) AND (room_type IS NULL OR room_type = ?)',
            [name, auth, conn, roomType]
        );

        if (existing) {
            await db.run(
                'UPDATE bans SET name = ?, auth = COALESCE(?, auth), conn = COALESCE(?, conn), reason = ?, banned_by = ?, banned_at = CURRENT_TIMESTAMP, expires_at = ?, room_type = ? WHERE id = ?',
                [name, auth, conn, reason, bannedBy, expiresAt, roomType, existing.id]
            );
        } else {
            await db.run(
                'INSERT INTO bans (name, auth, conn, reason, banned_by, expires_at, room_type) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [name, auth, conn, reason, bannedBy, expiresAt, roomType]
            );
        }

        return true;
    }

    async tempBan(name, auth, conn, reason = 'Geçici Ban', bannedBy = null, roomType = null, days = 3) {
        const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19);
        return await this.ban(name, auth, conn, reason, bannedBy, expiresAt, roomType);
    }

    async banByName(name, reason = 'Karaliste', bannedBy = null, expiresAt = null, roomType = null) {
        const history = await this.getPlayerHistory(name);
        const auth = history?.auth || null;
        const conn = history?.conn || null;
        return await this.ban(history?.name || name, auth, conn, reason, bannedBy, expiresAt, roomType);
    }

    async unban(identifier) {
        const ban = await db.get(
            'SELECT * FROM bans WHERE LOWER(name) = LOWER(?) OR auth = ? OR conn = ?',
            [identifier, identifier, identifier]
        );

        if (ban) {
            await db.run('DELETE FROM bans WHERE id = ?', [ban.id]);

            if (ban.auth) {
                await db.run('DELETE FROM bans WHERE auth = ?', [ban.auth]);
            }
            if (ban.conn) {
                await db.run('DELETE FROM bans WHERE conn = ?', [ban.conn]);
            }

            return true;
        }

        return false;
    }

    async isBanned(name, auth, conn, roomType = null) {
        const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
        let ban = null;

        const params = [];
        let paramIndex = 2;

        let scopeCheck;
        if (roomType) {
            scopeCheck = `AND (room_type IS NULL OR room_type = $${paramIndex})`;
            paramIndex++;
        } else {
            scopeCheck = `AND room_type IS NULL`;
        }

        const expiryCheck = `AND (expires_at IS NULL OR expires_at > $${paramIndex})`;

        if (name) {
            const nameParams = [name];
            if (roomType) nameParams.push(roomType);
            nameParams.push(now);
            ban = await db.get(
                `SELECT * FROM bans WHERE LOWER(name) = LOWER($1) ${scopeCheck} ${expiryCheck}`,
                nameParams
            );
            if (ban) return ban;
        }

        if (auth) {
            const authParams = [auth];
            if (roomType) authParams.push(roomType);
            authParams.push(now);
            ban = await db.get(
                `SELECT * FROM bans WHERE auth = $1 ${scopeCheck} ${expiryCheck}`,
                authParams
            );
            if (ban) return ban;
        }

        if (conn) {
            const connParams = [conn];
            if (roomType) connParams.push(roomType);
            connParams.push(now);
            ban = await db.get(
                `SELECT * FROM bans WHERE conn = $1 ${scopeCheck} ${expiryCheck}`,
                connParams
            );
            if (ban) return ban;
        }

        return null;
    }

    async getBanList() {
        const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
        return await db.all('SELECT * FROM bans WHERE expires_at IS NULL OR expires_at > ? ORDER BY banned_at DESC', [now]);
    }

    async getPlayerHistory(name) {
        return await db.get(
            'SELECT * FROM player_history WHERE LOWER(name) = LOWER(?)',
            [name]
        );
    }

    async isInHistory(name) {
        const record = await db.get(
            'SELECT id FROM player_history WHERE LOWER(name) = LOWER(?)',
            [name]
        );
        return !!record;
    }
}

module.exports = BanManager;
