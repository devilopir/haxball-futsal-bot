const bcrypt = require('bcrypt');
const db = require('../database/Database');

const SALT_ROUNDS = 10;

class AuthManager {
    constructor(roomManager) {
        this.rm = roomManager;
        this.loggedInPlayers = new Map();
    }

    async register(auth, password, nickname) {
        try {
            if (await this.isRegistered(auth, nickname)) {
                return { success: false, error: 'Bu nick ile zaten kayıtlısın!' };
            }

            const nicknameOwner = await db.get('SELECT id FROM users WHERE LOWER(nickname) = LOWER(?)', [nickname]);
            if (nicknameOwner) {
                return { success: false, error: 'Bu nick başka bir hesaba kayıtlı!' };
            }

            const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
            const userResult = await db.runReturning(
                'INSERT INTO users (auth, password_hash, nickname) VALUES (?, ?, ?)',
                [auth, passwordHash, nickname]
            );
            const userId = userResult.lastInsertRowid;
            await db.run('INSERT INTO stats (user_id) VALUES (?)', [userId]);

            return { success: true, userId };
        } catch (err) {
            console.error('Kayıt hatası:', err.message);
            return { success: false, error: 'Kayıt sırasında hata oluştu!' };
        }
    }

    async isRegistered(auth, nickname) {
        if (nickname) {
            const user = await db.get('SELECT id FROM users WHERE auth = ? AND LOWER(nickname) = LOWER(?)', [auth, nickname]);
            return !!user;
        }
        const user = await db.get('SELECT id FROM users WHERE auth = ?', [auth]);
        return !!user;
    }

    async login(auth, nickname, password) {
        try {
            const user = await db.get('SELECT * FROM users WHERE LOWER(nickname) = LOWER(?)', [nickname]);
            if (!user) {
                return { success: false, error: 'Bu nick ile kayıtlı hesap bulunamadı!' };
            }

            const isValid = await bcrypt.compare(password, user.password_hash);
            if (!isValid) {
                return { success: false, error: 'Yanlış şifre!' };
            }

            await db.run('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);
            return { success: true, user };
        } catch (err) {
            console.error('Giriş hatası:', err.message);
            return { success: false, error: 'Giriş sırasında hata oluştu!' };
        }
    }

    async autoLogin(playerId, auth, conn, currentNick) {
        if (!currentNick) return { success: false };

        const user = await db.get('SELECT * FROM users WHERE auth = ? AND LOWER(nickname) = LOWER(?)', [auth, currentNick]);
        if (!user) return { success: false };

        await db.run('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);

        this.loggedInPlayers.set(playerId, {
            userId: user.id,
            auth: auth,
            nickname: user.nickname,
            isAdmin: user.is_admin === 1,
            isVip: user.allowed_room === 'vip'
        });

        return { success: true, user };
    }

    logout(playerId) {
        this.loggedInPlayers.delete(playerId);
    }

    async changePassword(auth, nickname, oldPassword, newPassword) {
        try {
            const user = await db.get('SELECT * FROM users WHERE auth = ? AND LOWER(nickname) = LOWER(?)', [auth, nickname]);
            if (!user) {
                return { success: false, error: 'Kullanıcı bulunamadı!' };
            }

            const isValid = await bcrypt.compare(oldPassword, user.password_hash);
            if (!isValid) {
                return { success: false, error: 'Eski şifre yanlış!' };
            }

            const newHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
            await db.run('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, user.id]);

            return { success: true };
        } catch (err) {
            console.error('Şifre değiştirme hatası:', err.message);
            return { success: false, error: 'Şifre değiştirme sırasında hata oluştu!' };
        }
    }

    async changeNickname(auth, newNickname, oldNickname) {
        try {
            await db.run('UPDATE users SET nickname = ? WHERE auth = ? AND LOWER(nickname) = LOWER(?)', [newNickname, auth, oldNickname]);
            return { success: true };
        } catch (err) {
            console.error('Nick değiştirme hatası:', err.message);
            return { success: false, error: 'Nick değiştirme sırasında hata oluştu!' };
        }
    }

    isLoggedIn(playerId) {
        return this.loggedInPlayers.has(playerId);
    }

    getLoggedInUser(playerId) {
        return this.loggedInPlayers.get(playerId) || null;
    }

    async isNicknameTaken(nickname, excludeUserId = null) {
        if (excludeUserId) {
            return await db.get('SELECT * FROM users WHERE LOWER(nickname) = LOWER(?) AND id != ?', [nickname, excludeUserId]) || null;
        }
        return await db.get('SELECT * FROM users WHERE LOWER(nickname) = LOWER(?)', [nickname]) || null;
    }

    async getUserByAuthAndNick(auth, nickname) {
        return await db.get('SELECT * FROM users WHERE auth = ? AND LOWER(nickname) = LOWER(?)', [auth, nickname]);
    }

    async isAdmin(auth, nickname) {
        if (nickname) {
            const user = await db.get('SELECT is_admin FROM users WHERE auth = ? AND LOWER(nickname) = LOWER(?)', [auth, nickname]);
            return !!(user?.is_admin);
        }
        const user = await db.get('SELECT is_admin FROM users WHERE auth = ? AND is_admin = 1', [auth]);
        return !!user;
    }

    async setAdmin(auth, nickname) {
        if (nickname) {
            await db.run('UPDATE users SET is_admin = 1 WHERE auth = ? AND LOWER(nickname) = LOWER(?)', [auth, nickname]);
        } else {
            await db.run('UPDATE users SET is_admin = 1 WHERE auth = ?', [auth]);
        }
    }

    async removeAdmin(auth, nickname) {
        if (nickname) {
            await db.run('UPDATE users SET is_admin = 0 WHERE auth = ? AND LOWER(nickname) = LOWER(?)', [auth, nickname]);
        } else {
            await db.run('UPDATE users SET is_admin = 0 WHERE auth = ?', [auth]);
        }
    }

    async getStats(userId) {
        return await db.get('SELECT * FROM stats WHERE user_id = ?', [userId]);
    }
}

module.exports = AuthManager;
