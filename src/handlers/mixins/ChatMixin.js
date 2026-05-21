const { Team, ABBREVIATIONS, INLINE_EMOJIS } = require('../../utils/constants');
const db = require('../../database/Database');

module.exports = {
  checkChatSpam(playerId) {
    const now = Date.now();
    const CHAT_WINDOW = 5000;
    const MAX_MESSAGES = 4;
    const MAX_WARNINGS = 3;

    if (!this.chatTimestamps.has(playerId)) {
      this.chatTimestamps.set(playerId, []);
    }

    const timestamps = this.chatTimestamps.get(playerId);
    const recentMessages = timestamps.filter(ts => now - ts < CHAT_WINDOW);
    this.chatTimestamps.set(playerId, recentMessages);

    if (recentMessages.length >= MAX_MESSAGES) {
      const warnings = (this.chatWarnings.get(playerId) || 0) + 1;
      this.chatWarnings.set(playerId, warnings);

      const waitTime = Math.ceil((CHAT_WINDOW - (now - recentMessages[0])) / 1000);

      return {
        allowed: false,
        waitTime,
        warnings,
        kick: warnings >= MAX_WARNINGS
      };
    }

    recentMessages.push(now);
    this.chatTimestamps.set(playerId, recentMessages);

    return { allowed: true, waitTime: 0, warnings: 0, kick: false };
  },

  async getPlayerChatStyle(auth) {
    if (!auth) return { prefix: '🥉', color: 0xFFFFFF, font: 'normal' };

    const cached = this.chatStyleCache.get(auth);
    if (cached && Date.now() < cached.expiresAt) return cached.style;

    const user = await db.get('SELECT allowed_room, is_admin FROM users WHERE auth = ?', [auth]);
    let style;
    if (user?.is_admin) {
      style = { prefix: '[Admin]', color: 0x4488FF, font: 'bold' };
    } else if (user?.allowed_room === 'vip') {
      style = { prefix: '⭐', color: 0xFFD700, font: 'normal' };
    } else {
      const stats = await this.rm.statsManager.getPlayerStatsByAuth(auth);
      style = { prefix: stats?.rank?.emoji || '🥉', color: 0xFFFFFF, font: 'normal' };
    }

    this.chatStyleCache.set(auth, { style, expiresAt: Date.now() + 30000 });
    return style;
  },

  async getPlayerRankEmoji(auth) {
    return (await this.getPlayerChatStyle(auth)).prefix;
  },

  formatGameTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  },

  async formatChatMessage(player, auth, message) {
    const style = await this.getPlayerChatStyle(auth);
    return { text: `${style.prefix} ${player.name}: ${message}`, color: style.color, font: style.font || 'normal' };
  },

  broadcastChat(senderId, formattedMessage, color = 0xFFFFFF, font = 'normal') {
    if (!this.rm.playerCommands) {
      this.rm.room.sendAnnouncement(formattedMessage, null, color, font, 1);
      return;
    }

    const allPlayers = this.rm.getRealPlayers();
    for (const p of allPlayers) {
      if (!this.rm.playerCommands.isMutedFor(p.id, senderId)) {
        this.rm.room.sendAnnouncement(formattedMessage, p.id, color, font, 1);
      }
    }
  },

  onPlayerChat(player, message) {
    if (!player) return false;
    this._handleChat(player, message).catch(e => console.error('[CHAT] Error:', e.message));
    return false;
  },

  async _handleChat(player, message) {
    const authData = this.rm.getPlayerAuthData(player.id);
    const playerWithAuth = {
      ...player,
      auth: authData?.auth,
      conn: authData?.conn
    };

    const isAdmin = this.rm.playerCommands?.isAdmin(playerWithAuth);
    const isCommand = String(message || '').startsWith('!');
    const isCaptainMode = this.rm.state.isCaptainMode();

    if (!isAdmin && await this.rm.playerCommands?.isTempMuted?.(authData?.auth)) {
      if (!isCommand && !isCaptainMode) {
        const remaining = await this.rm.playerCommands.getTempMuteRemainingSeconds(authData?.auth);
        const admins = this.rm.getRealPlayers().filter(p => this.rm.playerCommands.isAdmin(p));
        if (admins.length > 0) {
          const mutedMsg = `🔇 [SUSTURMA ${remaining}sn] ${player.name}: ${message}`;
          admins.forEach((admin) => {
            this.rm.room.sendAnnouncement(mutedMsg, admin.id, 0x888888, 'italic', 0);
          });
        }
        if (this.rm.playerCommands.shouldNotifyTempMute(player.id)) {
          this.rm.room.sendAnnouncement(
            `Susturuldun. Kalan: ${remaining}sn`,
            player.id, 0xFF6600, 'bold', 1
          );
        }
        await this._logChat(player, authData, `[SUSTURMA] ${message}`);
        return;
      }
    }

    if (!isAdmin && await this.rm.playerCommands?.isPermanentlyMuted(authData?.auth)) {
      if (!isCommand && !isCaptainMode) {
        const admins = this.rm.getRealPlayers().filter(p => this.rm.playerCommands.isAdmin(p));
        if (admins.length > 0) {
          const mutedMsg = `🔇 [SUSTURULMUŞ] ${player.name}: ${message}`;
          admins.forEach(admin => {
            this.rm.room.sendAnnouncement(mutedMsg, admin.id, 0x888888, 'italic', 0);
          });
        }
        await this._logChat(player, authData, `[SUSTURULMUŞ] ${message}`);
        return;
      }
    }

    this.rm.playerActivity.update(player.id);

    if (message.startsWith('!')) {
      await this._logChat(player, authData, message);
      const result = this.rm.commandHandler.processCommand(playerWithAuth, message);
      if (!result.handled) {
        this.rm.room.sendAnnouncement(
          'Bilinmeyen komut. !yardim yazarak komutları görebilirsin.',
          player.id, 0xFF6600, 'normal', 1
        );
      }
      return;
    }

    if (this.rm.state.isCaptainMode()) {
      const result = this.rm.handleCaptainChoice(playerWithAuth, message);
      if (result === false) {
        return;
      }
    }

    if (!this.rm.playerCommands.isChatEnabled() && !isAdmin) {
      this.rm.room.sendAnnouncement('Chat şu anda kapalı', player.id, 0xFF6600, 'normal', 1);
      return;
    }

    const isVip = !!this.rm.authManager?.getLoggedInUser(player.id)?.isVip;
    if (!isAdmin && !isVip) {
      const chatCheck = this.checkChatSpam(player.id);
      if (!chatCheck.allowed) {
        if (chatCheck.kick) {
          this.rm.safeKickPlayer(player.id, 'Chat spam!', false);
          return;
        }
        this.rm.room.sendAnnouncement(
          `Yavaş! ${chatCheck.waitTime}sn bekle (Uyarı ${chatCheck.warnings}/3)`,
          player.id, 0xFF6600, 'normal', 1
        );
        return;
      }
    }

    if (!isAdmin && this.profanityFilter.enabled) {
      const textToCheck = this._extractChatText(message);
      if (this.profanityFilter.check(textToCheck)) {
        const offense = this._handleOffense(player, authData);
        try {
          await this._logChat(player, authData, `[ENGELLENDI:KUFUR] ${message}`);
        } catch (e) {}
        const admins = this.rm.getRealPlayers().filter(p => this.rm.playerCommands.isAdmin(p));
        if (admins.length > 0) {
          const tag = `UYARI #${offense?.warningNumber || '?'}`;
          const blockedMsg = `⛔ [${tag}] ${player.name}: ${message}`;
          admins.forEach((admin) => {
            this.rm.room.sendAnnouncement(blockedMsg, admin.id, 0x888888, 'italic', 0);
          });
        }
        return;
      }
    }

    await this._logChat(player, authData, message);
    await this._processChat(player, authData, message);
  },

  _handleOffense(player, authData, offense = null) {
    const auth = authData?.auth;
    const safeOffense = offense || this.profanityFilter.recordOffense(auth);

    if (this.profanityFilter.canWarn(player.id)) {
      this.rm.room.sendAnnouncement(
        `⚠️ ${player.name}, ᴀʀɢᴏ/ᴋᴜғᴜʀ ᴀʟɢɪʟᴀɴᴅɪ. ᴍᴇsᴀᴊ ᴇɴɢᴇʟʟᴇɴᴅɪ.`,
        null, 0xFF4444, 'bold', 1
      );
    }

    return safeOffense;
  },

  _extractChatText(message) {
    const lower = message.toLowerCase();
    if (lower.startsWith('t ') && message.length > 2) return message.slice(2).trim();
    if (lower.startsWith('s ') && message.length > 2) return message.slice(2).trim();
    return message.trim();
  },

  async _logChat(player, authData, message) {
    this.rm.logger.chat(player, message);
    await this.rm.playerCommands?.logChat(authData?.auth, player.name, message);
    this.rm.recordRecentChat?.({ name: player.name, team: player.team, message: String(message).slice(0, 250) });
  },

  async _processChat(player, authData, message) {
    const trimmedMsg = message.trim();
    const lowerMsg = trimmedMsg.toLowerCase();

    const now = Date.now();
    const MESSAGE_COMBINE_WINDOW = 2000;

    if (!this.messageHistory.has(player.id)) {
      this.messageHistory.set(player.id, []);
    }

    const playerHistory = this.messageHistory.get(player.id);
    playerHistory.push({ text: lowerMsg, time: now });

    const recentMessages = playerHistory.filter(m => now - m.time < MESSAGE_COMBINE_WINDOW);
    this.messageHistory.set(player.id, recentMessages);

    if (lowerMsg.startsWith('t ') && trimmedMsg.length > 2) {
      const teamMessage = trimmedMsg.slice(2).trim();
      if (teamMessage && player.team !== Team.SPECTATORS) {
        const teamPlayers = this.rm.getRealPlayers().filter(p => p.team === player.team);
        const teamColor = player.team === Team.RED ? 0xFF6666 : 0x6666FF;
        const teamName = player.team === Team.RED ? '🔴' : '🔵';
        teamPlayers.forEach(p => {
          this.rm.room.sendAnnouncement(
            `${teamName} [TAKIM] ${player.name}: ${teamMessage}`,
            p.id, teamColor, 'normal', 0
          );
        });
        return;
      }
    }

    if (lowerMsg.startsWith('s ') && trimmedMsg.length > 2) {
      const specMessage = trimmedMsg.slice(2).trim();
      if (specMessage && player.team === Team.SPECTATORS) {
        const specPlayers = this.rm.getRealPlayers().filter(p => p.team === Team.SPECTATORS);
        specPlayers.forEach(p => {
          this.rm.room.sendAnnouncement(
            `👁️ [SPEC] ${player.name}: ${specMessage}`,
            p.id, 0xAAAAAA, 'normal', 0
          );
        });
        return;
      }
    }

    if (lowerMsg === 'ig') {
      const hour = new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', hour: 'numeric', hour12: false });
      const h = parseInt(hour, 10);
      let greeting;
      if (h >= 6 && h < 12) greeting = 'iyi sabahlar';
      else if (h >= 12 && h < 18) greeting = 'iyi günler';
      else if (h >= 18 && h < 22) greeting = 'iyi akşamlar';
      else greeting = 'iyi geceler';
      const g = await this.formatChatMessage(player, authData?.auth, greeting);
      this.broadcastChat(player.id, g.text, g.color, g.font);
      return;
    }

    if (ABBREVIATIONS[lowerMsg]) {
      const expanded = ABBREVIATIONS[lowerMsg];
      const a = await this.formatChatMessage(player, authData?.auth, expanded);
      this.broadcastChat(player.id, a.text, a.color, a.font);
      return;
    }

    let processedMsg = trimmedMsg;
    let hasEmoji = false;
    for (const [emoji, replacement] of Object.entries(INLINE_EMOJIS)) {
      const escapedEmoji = emoji.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(^|\\s)${escapedEmoji}($|\\s)`, 'gi');
      const newMsg = processedMsg.replace(regex, `$1${replacement}$2`);
      if (newMsg !== processedMsg) {
        processedMsg = newMsg;
        hasEmoji = true;
      }
    }

    if (hasEmoji) {
      const e = await this.formatChatMessage(player, authData?.auth, processedMsg);
      this.broadcastChat(player.id, e.text, e.color, e.font);
      return;
    }

    const chatMsg = await this.formatChatMessage(player, authData?.auth, trimmedMsg);
    this.broadcastChat(player.id, chatMsg.text, chatMsg.color, chatMsg.font);
  },
};
