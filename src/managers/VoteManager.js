const { Team } = require('../utils/constants');

const VOTE_DURATION_MS = 45000;
const MIN_PLAYERS_TO_VOTE = 4;
const INITIATOR_COOLDOWN_MS = 5 * 60 * 1000;
const ROOM_COOLDOWN_AFTER_KICK_MS = 3 * 60 * 1000;
const TARGET_COOLDOWN_MS = 10 * 60 * 1000;
const REQUIRED_RATIO = 0.5;

class VoteManager {
    constructor(roomManager) {
        this.rm = roomManager;
        this.activeVote = null;
        this.voteTimer = null;

        this.initiatorCooldowns = new Map();
        this.targetCooldowns = new Map();
        this.roomCooldownUntil = 0;
    }

    _playingPlayers() {
        return this.rm.getRealPlayers().filter(
            p => p.team === Team.RED || p.team === Team.BLUE
        );
    }

    _isVipOrAdmin(playerId) {
        const loggedUser = this.rm.authManager?.getLoggedInUser(playerId);
        return !!(loggedUser?.isAdmin || loggedUser?.isVip);
    }

    _announce(msg, color = 0xFFFF00) {
        this.rm.room.sendAnnouncement(msg, null, color, 'bold', 1);
    }

    _sendPrivate(playerId, msg, color = 0xFF6600) {
        this.rm.room.sendAnnouncement(msg, playerId, color, 'normal', 1);
    }

    startVote(initiator, targetName) {
        const now = Date.now();
        const initiatorAuth = this.rm.getPlayerAuthData(initiator.id)?.auth;

        if (!initiatorAuth) {
            this._sendPrivate(initiator.id, 'Oylama başlatmak için giriş yap!');
            return;
        }

        const loggedInitiator = this.rm.authManager?.getLoggedInUser(initiator.id);
        if (loggedInitiator?.isAdmin) {
            this._sendPrivate(initiator.id, 'Admin olarak direkt !kick kullanabilirsin.', 0xFFFF00);
            return;
        }

        if (this.activeVote) {
            this._sendPrivate(initiator.id, `Zaten aktif bir oylama var: ${this.activeVote.targetName}`, 0xFF6600);
            return;
        }

        if (now < this.roomCooldownUntil) {
            const remaining = Math.ceil((this.roomCooldownUntil - now) / 1000);
            this._sendPrivate(initiator.id, `Son oylamadan sonra bekleme süresi: ${remaining}sn`, 0xFF6600);
            return;
        }

        const initiatorCooldownUntil = this.initiatorCooldowns.get(initiatorAuth) || 0;
        if (now < initiatorCooldownUntil) {
            const remaining = Math.ceil((initiatorCooldownUntil - now) / 1000);
            this._sendPrivate(initiator.id, `Tekrar oylama başlatmak için ${remaining}sn bekle.`, 0xFF6600);
            return;
        }

        const playing = this._playingPlayers();
        if (playing.length < MIN_PLAYERS_TO_VOTE) {
            this._sendPrivate(initiator.id, `Oylama için en az ${MIN_PLAYERS_TO_VOTE} oynayan oyuncu gerekli.`, 0xFF6600);
            return;
        }

        const target = this.rm.getRealPlayers().find(
            p => p.name.toLowerCase().includes(targetName.toLowerCase()) && p.id !== initiator.id
        );
        if (!target) {
            this._sendPrivate(initiator.id, `"${targetName}" bulunamadı.`, 0xFF6600);
            return;
        }

        if (this._isVipOrAdmin(target.id)) {
            this._sendPrivate(initiator.id, 'Admin ve VIP oyuncular oylamaya açık değil.', 0xFF6600);
            return;
        }

        const targetAuth = this.rm.getPlayerAuthData(target.id)?.auth || target.name;
        const targetCooldownUntil = this.targetCooldowns.get(targetAuth) || 0;
        if (now < targetCooldownUntil) {
            const remaining = Math.ceil((targetCooldownUntil - now) / 1000);
            this._sendPrivate(initiator.id, `${target.name} için ${remaining}sn daha oylama başlatılamaz.`, 0xFF6600);
            return;
        }

        const eligible = playing.filter(p => p.id !== target.id);
        const requiredVotes = Math.ceil(eligible.length * REQUIRED_RATIO) + 1;

        this.activeVote = {
            targetId: target.id,
            targetName: target.name,
            targetAuth,
            initiatorId: initiator.id,
            initiatorAuth,
            votes: new Set([initiator.id]),
            eligible,
            requiredVotes,
            startedAt: now
        };

        this.initiatorCooldowns.set(initiatorAuth, now + INITIATOR_COOLDOWN_MS);

        const secsLeft = Math.round(VOTE_DURATION_MS / 1000);
        this._announce(
            `🗳️ OYLAMA: ${target.name} atılsın mı? (${initiator.name} başlattı)`,
            0xFFAA00
        );
        this._announce(
            `!evet yazın | ${requiredVotes}/${eligible.length} oy gerekli | ${secsLeft}sn`,
            0xFFDD88
        );

        this.voteTimer = setTimeout(() => this._finalize(), VOTE_DURATION_MS);
    }

    castVote(player) {
        if (!this.activeVote) {
            this._sendPrivate(player.id, 'Aktif oylama yok.', 0xFF6600);
            return;
        }

        const vote = this.activeVote;

        if (player.id === vote.targetId) {
            this._sendPrivate(player.id, 'Kendi oylamanıza oy veremezsiniz.', 0xFF6600);
            return;
        }

        const isEligible = vote.eligible.some(p => p.id === player.id);
        if (!isEligible) {
            this._sendPrivate(player.id, 'Bu oylamada oy hakkınız yok (seyirci veya sonradan katıldınız).', 0xFF6600);
            return;
        }

        if (vote.votes.has(player.id)) {
            this._sendPrivate(player.id, 'Zaten oy kullandın.', 0xFF6600);
            return;
        }

        vote.votes.add(player.id);
        const current = vote.votes.size;
        const needed = vote.requiredVotes;

        this._announce(
            `✅ ${player.name} oy kullandı (${current}/${needed})`,
            0x88FF88
        );

        if (current >= needed) {
            clearTimeout(this.voteTimer);
            this.voteTimer = null;
            this._finalize();
        }
    }

    onPlayerLeave(playerId) {
        if (!this.activeVote) return;

        if (playerId === this.activeVote.targetId) {
            this._announce(`🗳️ Oylama iptal: ${this.activeVote.targetName} zaten ayrıldı.`, 0xAAAAAA);
            this._cancel();
        }
    }

    _finalize() {
        if (!this.activeVote) return;

        const vote = this.activeVote;
        const yesCount = vote.votes.size;
        const needed = vote.requiredVotes;

        this.activeVote = null;
        if (this.voteTimer) {
            clearTimeout(this.voteTimer);
            this.voteTimer = null;
        }

        if (yesCount >= needed) {
            this._announce(
                `🔨 Oylama kabul! ${vote.targetName} atıldı. (${yesCount}/${vote.eligible.length})`,
                0xFF4444
            );
            this.roomCooldownUntil = Date.now() + ROOM_COOLDOWN_AFTER_KICK_MS;
            this.targetCooldowns.set(vote.targetAuth, Date.now() + TARGET_COOLDOWN_MS);
            try {
                this.rm.safeKickPlayer(vote.targetId, 'Oylama ile atıldı', false);
            } catch (e) {}
        } else {
            this._announce(
                `❌ Oylama reddedildi. ${vote.targetName} kaldı. (${yesCount}/${needed} gerekli)`,
                0xAAAAAA
            );
        }
    }

    _cancel() {
        this.activeVote = null;
        if (this.voteTimer) {
            clearTimeout(this.voteTimer);
            this.voteTimer = null;
        }
    }

    destroy() {
        this._cancel();
        this.initiatorCooldowns.clear();
        this.targetCooldowns.clear();
    }
}

module.exports = VoteManager;
