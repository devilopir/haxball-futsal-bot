const { Pool } = require('pg');
const config = require('../../config');

const DATABASE_URL = config.databaseUrl;

class DatabaseManager {
    constructor() {
        this.pool = null;
        this._ready = false;
    }

    async connect() {
        this.pool = new Pool({
            connectionString: DATABASE_URL,
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 5000,
        });

        this.pool.on('error', (err) => {
            console.error('[DB] Pool hatası:', err.message);
        });

        await this.initTables();
        this._ready = true;
        console.log('[DB] PostgreSQL bağlantısı hazır');
        return this;
    }

    async close() {
        if (this.pool) {
            await this.pool.end();
            this.pool = null;
        }
    }

    _convertParams(sql) {
        let i = 0;
        return sql.replace(/\?/g, () => `$${++i}`);
    }

    async run(sql, params = []) {
        const pgSql = this._convertParams(sql);
        try {
            const result = await this.pool.query(pgSql, params);
            return {
                changes: result.rowCount,
                lastInsertRowid: result.rows?.[0]?.id ?? null,
            };
        } catch (e) {
            console.error('[DB] run hatası:', e.message, '\nSQL:', pgSql);
            throw e;
        }
    }

    async runReturning(sql, params = []) {
        const pgSql = this._convertParams(sql);
        const withReturning = pgSql.trimEnd().endsWith(';')
            ? pgSql.replace(/;\s*$/, ' RETURNING id;')
            : pgSql + ' RETURNING id';
        try {
            const result = await this.pool.query(withReturning, params);
            return {
                changes: result.rowCount,
                lastInsertRowid: result.rows?.[0]?.id ?? null,
            };
        } catch (e) {
            console.error('[DB] runReturning hatası:', e.message, '\nSQL:', withReturning);
            throw e;
        }
    }

    async get(sql, params = []) {
        const pgSql = this._convertParams(sql);
        try {
            const result = await this.pool.query(pgSql, params);
            return result.rows[0] || null;
        } catch (e) {
            console.error('[DB] get hatası:', e.message, '\nSQL:', pgSql);
            throw e;
        }
    }

    async all(sql, params = []) {
        const pgSql = this._convertParams(sql);
        try {
            const result = await this.pool.query(pgSql, params);
            return result.rows;
        } catch (e) {
            console.error('[DB] all hatası:', e.message, '\nSQL:', pgSql);
            throw e;
        }
    }

    async getSetting(key, defaultValue = null) {
        const row = await this.get('SELECT value FROM settings WHERE key = $1', [key]);
        return row ? row.value : defaultValue;
    }

    async setSetting(key, value) {
        await this.pool.query(
            'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value',
            [key, String(value)]
        );
    }

    async transaction(fn) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            const wrappedDb = {
                run: async (sql, params = []) => {
                    const pgSql = this._convertParams(sql);
                    const result = await client.query(pgSql, params);
                    return { changes: result.rowCount, lastInsertRowid: result.rows?.[0]?.id ?? null };
                },
                get: async (sql, params = []) => {
                    const pgSql = this._convertParams(sql);
                    const result = await client.query(pgSql, params);
                    return result.rows[0] || null;
                },
                all: async (sql, params = []) => {
                    const pgSql = this._convertParams(sql);
                    const result = await client.query(pgSql, params);
                    return result.rows;
                },
            };
            await fn(wrappedDb);
            await client.query('COMMIT');
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    }

    async initTables() {
        await this.pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                auth TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                nickname TEXT UNIQUE NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_login TIMESTAMP,
                is_admin INTEGER DEFAULT 0,
                allowed_room TEXT DEFAULT NULL,
                position TEXT DEFAULT NULL
            );

            CREATE TABLE IF NOT EXISTS stats (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL UNIQUE,
                matches INTEGER DEFAULT 0,
                wins INTEGER DEFAULT 0,
                losses INTEGER DEFAULT 0,
                goals INTEGER DEFAULT 0,
                assists INTEGER DEFAULT 0,
                own_goals INTEGER DEFAULT 0,
                clean_sheets INTEGER DEFAULT 0,
                mvp_count INTEGER DEFAULT 0,
                points INTEGER DEFAULT 0,
                peak_points INTEGER DEFAULT 0,
                hat_tricks INTEGER DEFAULT 0,
                best_win_streak INTEGER DEFAULT 0,
                current_win_streak INTEGER DEFAULT 0,
                FOREIGN KEY (user_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS bans (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                auth TEXT,
                conn TEXT,
                reason TEXT DEFAULT 'Karaliste',
                banned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                banned_by TEXT,
                expires_at TIMESTAMP DEFAULT NULL,
                room_type TEXT DEFAULT NULL
            );

            CREATE TABLE IF NOT EXISTS player_history (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                auth TEXT,
                conn TEXT,
                last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS celebrations (
                id SERIAL PRIMARY KEY,
                auth TEXT UNIQUE NOT NULL,
                message TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS announcements (
                id SERIAL PRIMARY KEY,
                type TEXT NOT NULL,
                message TEXT,
                interval_minutes INTEGER
            );

            CREATE TABLE IF NOT EXISTS chat_logs (
                id SERIAL PRIMARY KEY,
                auth TEXT NOT NULL,
                player_name TEXT NOT NULL,
                message TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS temp_mutes (
                id SERIAL PRIMARY KEY,
                auth TEXT UNIQUE NOT NULL,
                until_ts BIGINT NOT NULL,
                reason TEXT DEFAULT ''
            );

            CREATE TABLE IF NOT EXISTS permanent_mutes (
                id SERIAL PRIMARY KEY,
                auth TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                reason TEXT NOT NULL,
                muted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS room_status (
                bot_id TEXT PRIMARY KEY,
                room_name TEXT NOT NULL,
                room_link TEXT DEFAULT '',
                players TEXT DEFAULT '[]',
                total INTEGER DEFAULT 0,
                red INTEGER DEFAULT 0,
                blue INTEGER DEFAULT 0,
                spec INTEGER DEFAULT 0,
                updated_at BIGINT DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS pending_commands (
                id SERIAL PRIMARY KEY,
                type TEXT NOT NULL,
                target_name TEXT,
                target_auth TEXT DEFAULT '',
                target_conn TEXT DEFAULT '',
                reason TEXT,
                message TEXT,
                executed_by TEXT DEFAULT '[]',
                created_at BIGINT NOT NULL,
                executed INTEGER DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS player_data (
                auth TEXT PRIMARY KEY,
                names TEXT DEFAULT '[]',
                conns TEXT DEFAULT '[]',
                first_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS action_logs (
                id SERIAL PRIMARY KEY,
                action_type TEXT NOT NULL,
                admin_name TEXT NOT NULL,
                target_name TEXT,
                target_auth TEXT,
                reason TEXT,
                room_name TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS file_send_queue (
                id SERIAL PRIMARY KEY,
                bot_id TEXT NOT NULL,
                channel_id TEXT NOT NULL,
                file_path TEXT NOT NULL,
                filename TEXT NOT NULL,
                caption TEXT DEFAULT '',
                created_at BIGINT NOT NULL,
                delivered INTEGER DEFAULT 0,
                delivered_at BIGINT DEFAULT 0,
                deliver_error TEXT DEFAULT ''
            );

            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS vip_settings (
                auth TEXT PRIMARY KEY,
                goal_celebration INTEGER DEFAULT 1,
                goal_effect_enabled INTEGER DEFAULT 1,
                celebration_type TEXT DEFAULT 'spinning',
                goal_effect_type TEXT DEFAULT 'goal_burst',
                goal_text_message TEXT DEFAULT NULL,
                animated_avatar TEXT DEFAULT NULL,
                avatar_speed REAL DEFAULT 1.0
            );

            CREATE TABLE IF NOT EXISTS invite_codes (
                code TEXT PRIMARY KEY,
                auth TEXT NOT NULL,
                nickname TEXT NOT NULL,
                created_at BIGINT NOT NULL,
                used INTEGER DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS match_replays (
                id SERIAL PRIMARY KEY,
                bot_id TEXT,
                room_name TEXT,
                map_name TEXT,
                red_score INTEGER,
                blue_score INTEGER,
                winner TEXT,
                red_players TEXT,
                blue_players TEXT,
                red_auths TEXT,
                blue_auths TEXT,
                replay_url TEXT,
                file_name TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS match_player_stats (
                id SERIAL PRIMARY KEY,
                match_id INTEGER NOT NULL REFERENCES match_replays(id),
                auth TEXT NOT NULL,
                nickname TEXT NOT NULL,
                team TEXT NOT NULL,
                goals INTEGER DEFAULT 0,
                assists INTEGER DEFAULT 0,
                own_goals INTEGER DEFAULT 0,
                touches INTEGER DEFAULT 0,
                is_mvp INTEGER DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS goal_events (
                id SERIAL PRIMARY KEY,
                match_id INTEGER NOT NULL REFERENCES match_replays(id),
                scorer_auth TEXT NOT NULL,
                scorer_name TEXT NOT NULL,
                assister_auth TEXT,
                assister_name TEXT,
                team TEXT NOT NULL,
                minute REAL DEFAULT 0,
                is_own_goal INTEGER DEFAULT 0,
                red_score INTEGER DEFAULT 0,
                blue_score INTEGER DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS achievements (
                id SERIAL PRIMARY KEY,
                auth TEXT NOT NULL,
                type TEXT NOT NULL,
                unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS daily_stats (
                id SERIAL PRIMARY KEY,
                auth TEXT NOT NULL,
                nickname TEXT NOT NULL,
                date TEXT NOT NULL,
                points_earned INTEGER DEFAULT 0,
                goals INTEGER DEFAULT 0,
                assists INTEGER DEFAULT 0,
                wins INTEGER DEFAULT 0,
                matches INTEGER DEFAULT 0,
                mvp_count INTEGER DEFAULT 0,
                clean_sheets INTEGER DEFAULT 0
            );
        `);

        await this.pool.query(`
            CREATE INDEX IF NOT EXISTS idx_users_auth ON users(auth);
            CREATE INDEX IF NOT EXISTS idx_action_logs_type ON action_logs(action_type);
            CREATE INDEX IF NOT EXISTS idx_action_logs_created ON action_logs(created_at);
            CREATE INDEX IF NOT EXISTS idx_temp_mutes_auth ON temp_mutes(auth);
            CREATE INDEX IF NOT EXISTS idx_permanent_mutes_auth ON permanent_mutes(auth);
            CREATE INDEX IF NOT EXISTS idx_bans_auth ON bans(auth);
            CREATE INDEX IF NOT EXISTS idx_bans_conn ON bans(conn);
            CREATE INDEX IF NOT EXISTS idx_bans_name ON bans(name);
            CREATE INDEX IF NOT EXISTS idx_player_history_name ON player_history(name);
            CREATE INDEX IF NOT EXISTS idx_chat_logs_auth ON chat_logs(auth);
            CREATE INDEX IF NOT EXISTS idx_player_data_auth ON player_data(auth);
            CREATE INDEX IF NOT EXISTS idx_pending_commands_created ON pending_commands(created_at);
            CREATE INDEX IF NOT EXISTS idx_pending_commands_target_auth ON pending_commands(target_auth);
            CREATE INDEX IF NOT EXISTS idx_pending_commands_target_conn ON pending_commands(target_conn);
            CREATE INDEX IF NOT EXISTS idx_admin_call_queue_created ON admin_call_queue(created_at);
            CREATE INDEX IF NOT EXISTS idx_admin_call_queue_delivered ON admin_call_queue(delivered, created_at);
            CREATE INDEX IF NOT EXISTS idx_chat_log_queue_created ON chat_log_queue(created_at);
            CREATE INDEX IF NOT EXISTS idx_chat_log_queue_delivered ON chat_log_queue(delivered, created_at);
            CREATE INDEX IF NOT EXISTS idx_file_send_queue_created ON file_send_queue(created_at);
            CREATE INDEX IF NOT EXISTS idx_file_send_queue_delivered ON file_send_queue(delivered, created_at);
            CREATE INDEX IF NOT EXISTS idx_match_player_stats_match ON match_player_stats(match_id);
            CREATE INDEX IF NOT EXISTS idx_match_player_stats_auth ON match_player_stats(auth);
            CREATE INDEX IF NOT EXISTS idx_goal_events_match ON goal_events(match_id);
            CREATE INDEX IF NOT EXISTS idx_goal_events_scorer ON goal_events(scorer_auth);
            CREATE INDEX IF NOT EXISTS idx_achievements_auth ON achievements(auth);
            CREATE INDEX IF NOT EXISTS idx_achievements_auth_type ON achievements(auth, type);
            CREATE INDEX IF NOT EXISTS idx_daily_stats_date ON daily_stats(date);
            CREATE INDEX IF NOT EXISTS idx_daily_stats_auth_date ON daily_stats(auth, date);
            CREATE INDEX IF NOT EXISTS idx_match_replays_created ON match_replays(created_at);
        `);
    }
}

const dbInstance = new DatabaseManager();

module.exports = dbInstance;
