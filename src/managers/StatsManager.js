const db = require('../database/Database');

const POINTS = {
    WIN: 10,
    LOSS: -5,
    GOAL: 3,
    ASSIST: 2,
    OWN_GOAL: -8,
    MVP: 5,
    CLEAN_SHEET: 4,
    HAT_TRICK: 8
};

const RANKS = [
    { name: 'Bronze', emoji: '🥉', minPoints: 0 },
    { name: 'Silver', emoji: '🥈', minPoints: 200 },
    { name: 'Gold', emoji: '🥇', minPoints: 500 },
    { name: 'Platinum', emoji: '💎', minPoints: 1000 },
    { name: 'Diamond', emoji: '👑', minPoints: 2000 },
    { name: 'Master', emoji: '🔥', minPoints: 3500 },
    { name: 'Legend', emoji: '⭐', minPoints: 5000 }
];

class StatsManager {
    constructor() {}

    async getStatsByUserId(userId) {
        return await db.get('SELECT * FROM stats WHERE user_id = ?', [userId]);
    }

    async getPlayerStatsByAuth(auth) {
        const user = await db.get('SELECT id FROM users WHERE auth = ?', [auth]);
        if (!user) return null;
        return await this.getPlayerStats(user.id);
    }

    async recordMatch(userId, won) {
        const stats = await this.getStatsByUserId(userId);
        if (!stats) return;

        if (won) {
            const newPoints = stats.points + POINTS.WIN;
            const newStreak = (stats.current_win_streak || 0) + 1;
            const bestStreak = Math.max(stats.best_win_streak || 0, newStreak);
            await db.run(
                `UPDATE stats
                 SET matches = matches + 1,
                     wins = wins + 1,
                     points = ?,
                     peak_points = GREATEST(COALESCE(peak_points, 0), ?),
                     current_win_streak = ?,
                     best_win_streak = ?
                 WHERE user_id = ?`,
                [newPoints, newPoints, newStreak, bestStreak, userId]
            );
        } else {
            const newPoints = Math.max(0, stats.points + POINTS.LOSS);
            await db.run(
                `UPDATE stats
                 SET matches = matches + 1,
                     losses = losses + 1,
                     points = ?,
                     peak_points = GREATEST(COALESCE(peak_points, 0), ?),
                     current_win_streak = 0
                 WHERE user_id = ?`,
                [newPoints, newPoints, userId]
            );
        }
    }

    async recordGoal(userId) {
        await db.run(
            `UPDATE stats
             SET goals = goals + 1,
                 points = points + ?,
                 peak_points = GREATEST(COALESCE(peak_points, 0), points + ?)
             WHERE user_id = ?`,
            [POINTS.GOAL, POINTS.GOAL, userId]
        );
    }

    async recordAssist(userId) {
        await db.run(
            `UPDATE stats
             SET assists = assists + 1,
                 points = points + ?,
                 peak_points = GREATEST(COALESCE(peak_points, 0), points + ?)
             WHERE user_id = ?`,
            [POINTS.ASSIST, POINTS.ASSIST, userId]
        );
    }

    async recordOwnGoal(userId) {
        const stats = await this.getStatsByUserId(userId);
        if (!stats) return;

        const newPoints = Math.max(0, stats.points + POINTS.OWN_GOAL);
        await db.run(
            `UPDATE stats
             SET own_goals = own_goals + 1,
                 points = ?,
                 peak_points = GREATEST(COALESCE(peak_points, 0), ?)
             WHERE user_id = ?`,
            [newPoints, newPoints, userId]
        );
    }

    async recordMVP(userId) {
        await db.run(
            `UPDATE stats
             SET mvp_count = mvp_count + 1,
                 points = points + ?,
                 peak_points = GREATEST(COALESCE(peak_points, 0), points + ?)
             WHERE user_id = ?`,
            [POINTS.MVP, POINTS.MVP, userId]
        );
    }

    async recordCleanSheet(userId) {
        await db.run(
            `UPDATE stats
             SET clean_sheets = clean_sheets + 1,
                 points = points + ?,
                 peak_points = GREATEST(COALESCE(peak_points, 0), points + ?)
             WHERE user_id = ?`,
            [POINTS.CLEAN_SHEET, POINTS.CLEAN_SHEET, userId]
        );
    }

    async recordHatTrick(userId) {
        await db.run(
            `UPDATE stats
             SET hat_tricks = hat_tricks + 1,
                 points = points + ?,
                 peak_points = GREATEST(COALESCE(peak_points, 0), points + ?)
             WHERE user_id = ?`,
            [POINTS.HAT_TRICK, POINTS.HAT_TRICK, userId]
        );
    }

    getRank(points) {
        let rank = RANKS[0];
        for (const r of RANKS) {
            if (points >= r.minPoints) {
                rank = r;
            }
        }
        return rank;
    }

    getNextRank(points) {
        for (const r of RANKS) {
            if (points < r.minPoints) {
                return r;
            }
        }
        return null;
    }

    async getPlayerStats(userId) {
        const stats = await this.getStatsByUserId(userId);
        if (!stats) return null;

        const user = await db.get('SELECT nickname FROM users WHERE id = ?', [userId]);
        const rank = this.getRank(stats.points);
        const nextRank = this.getNextRank(stats.points);
        const winRate = stats.matches > 0 ? Math.round((stats.wins / stats.matches) * 100) : 0;

        return {
            name: user?.nickname || 'Unknown',
            matches: stats.matches,
            wins: stats.wins,
            losses: stats.losses,
            goals: stats.goals,
            assists: stats.assists,
            ownGoals: stats.own_goals,
            cleanSheets: stats.clean_sheets,
            mvpCount: stats.mvp_count,
            hatTricks: stats.hat_tricks,
            points: stats.points,
            peakPoints: stats.peak_points || 0,
            rank,
            nextRank,
            winRate,
            pointsToNext: nextRank ? nextRank.minPoints - stats.points : 0,
            bestWinStreak: stats.best_win_streak || 0,
            currentWinStreak: stats.current_win_streak || 0
        };
    }

    async getLeaderboard(limit = 10) {
        const rows = await db.all(`
            SELECT u.nickname as name, s.*
            FROM stats s
            JOIN users u ON s.user_id = u.id
            ORDER BY s.points DESC
            LIMIT ?
        `, [limit]);

        return rows.map((row, i) => ({
            position: i + 1,
            name: row.name,
            matches: row.matches,
            wins: row.wins,
            losses: row.losses,
            goals: row.goals,
            assists: row.assists,
            ownGoals: row.own_goals,
            cleanSheets: row.clean_sheets,
            mvpCount: row.mvp_count,
            hatTricks: row.hat_tricks,
            points: row.points,
            rank: this.getRank(row.points)
        }));
    }

    async getStatLeaderboard(kind, limit = 10) {
        const map = {
            goals: { column: 'goals' },
            assists: { column: 'assists' },
            cs: { column: 'clean_sheets' },
            mvp: { column: 'mvp_count' },
            wins: { column: 'wins' },
            losses: { column: 'losses' }
        };
        const ALLOWED_COLUMNS = new Set(['goals', 'assists', 'clean_sheets', 'mvp_count', 'wins', 'losses']);
        const entry = map[String(kind || '').toLowerCase()];
        if (!entry || !ALLOWED_COLUMNS.has(entry.column)) return [];

        const rows = await db.all(`
            SELECT u.nickname as name, s.${entry.column} as value, s.points as points
            FROM stats s
            JOIN users u ON s.user_id = u.id
            ORDER BY s.${entry.column} DESC, s.points DESC
            LIMIT ?
        `, [limit]);

        return rows.map((row, i) => ({
            position: i + 1,
            name: row.name,
            value: row.value,
            points: row.points,
            rank: this.getRank(row.points)
        }));
    }

    async getPlayerPosition(userId) {
        const rows = await db.all('SELECT user_id FROM stats ORDER BY points DESC');
        const index = rows.findIndex(r => r.user_id === userId);
        return index === -1 ? null : index + 1;
    }

    async getStreakLeaderboard(limit = 10) {
        const rows = await db.all(`
            SELECT u.nickname as name, s.best_win_streak, s.current_win_streak, s.wins, s.points
            FROM stats s
            JOIN users u ON s.user_id = u.id
            WHERE COALESCE(s.best_win_streak, 0) > 0
            ORDER BY s.best_win_streak DESC, s.current_win_streak DESC, s.wins DESC
            LIMIT ?
        `, [limit]);

        return rows.map((row, i) => ({
            position: i + 1,
            name: row.name,
            bestStreak: row.best_win_streak || 0,
            currentStreak: row.current_win_streak || 0,
            wins: row.wins,
            points: row.points,
            rank: this.getRank(row.points)
        }));
    }

    async getTotalPlayers() {
        const result = await db.get('SELECT COUNT(*) as count FROM users');
        return result?.count || 0;
    }

    async resetPlayerStats(auth) {
        if (!auth) return false;
        const user = await db.get('SELECT id FROM users WHERE auth = ?', [auth]);
        if (!user) return false;
        await db.run(`UPDATE stats SET
            points = 0, wins = 0, losses = 0, goals = 0, assists = 0,
            own_goals = 0, clean_sheets = 0, mvp_count = 0, matches = 0,
            hat_tricks = 0, current_win_streak = 0, best_win_streak = 0,
            peak_points = 0
            WHERE user_id = ?`, [user.id]);
        return true;
    }

    async resetAllStats() {
        const total = (await db.get('SELECT COUNT(*) as count FROM stats'))?.count || 0;
        if (!total) return 0;

        await db.transaction(async (tx) => {
            await tx.run(`UPDATE stats
                    SET peak_points = GREATEST(COALESCE(peak_points, 0), points)`);
            await tx.run(`UPDATE stats SET matches = 0, wins = 0, losses = 0, goals = 0,
                    assists = 0, own_goals = 0, clean_sheets = 0, mvp_count = 0,
                    points = 0, hat_tricks = 0, current_win_streak = 0, best_win_streak = 0`);
        });

        return total;
    }
}

module.exports = StatsManager;
