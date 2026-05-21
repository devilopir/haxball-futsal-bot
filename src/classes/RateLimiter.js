class RateLimiter {
    constructor(options = {}) {
        this.windowMs = options.windowMs || 10000;
        this.maxRequests = options.maxRequests || 5;
        this.maxWarnings = options.maxWarnings || 3;
        this.requests = new Map();
        this.cleanupInterval = setInterval(() => this.cleanup(), 300000);
    }

    check(playerId) {
        const now = Date.now();

        if (!this.requests.has(playerId)) {
            this.requests.set(playerId, { timestamps: [], warnings: 0 });
        }

        const playerData = this.requests.get(playerId);

        playerData.timestamps = playerData.timestamps.filter(
            ts => now - ts < this.windowMs
        );

        if (playerData.timestamps.length >= this.maxRequests) {
            playerData.warnings++;

            const oldestTimestamp = playerData.timestamps[0];
            const remainingTime = Math.ceil((this.windowMs - (now - oldestTimestamp)) / 1000);

            return {
                allowed: false,
                warning: playerData.warnings < this.maxWarnings,
                kick: playerData.warnings >= this.maxWarnings,
                remainingTime,
                warningCount: playerData.warnings
            };
        }

        playerData.timestamps.push(now);

        return {
            allowed: true,
            warning: false,
            kick: false,
            remainingTime: 0,
            warningCount: playerData.warnings
        };
    }

    reset(playerId) {
        this.requests.delete(playerId);
    }

    resetWarnings(playerId) {
        const playerData = this.requests.get(playerId);
        if (playerData) {
            playerData.warnings = 0;
        }
    }

    cleanup() {
        const now = Date.now();
        for (const [playerId, data] of this.requests.entries()) {
            if (!data.timestamps || data.timestamps.length === 0) {
                this.requests.delete(playerId);
                continue;
            }
            const maxTimestamp = data.timestamps.reduce((max, ts) => ts > max ? ts : max, 0);
            if (now - maxTimestamp > 300000) {
                this.requests.delete(playerId);
            }
        }
    }

    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        this.requests.clear();
    }
}

module.exports = RateLimiter;
