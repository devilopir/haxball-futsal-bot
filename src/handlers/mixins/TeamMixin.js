const { Team, GameMode } = require('../../utils/constants');
const MAPS = require('../../../maps');

module.exports = {
  onPlayerAdminChange(changedPlayer, byPlayer) {
    if (!changedPlayer) return;

    if (byPlayer && byPlayer.id !== 0) {
      if (changedPlayer.admin) {
        this.rm.room.setPlayerAdmin(changedPlayer.id, false);
        this.rm.room.sendAnnouncement(
          'Admin yetkisi sadece yönetim tarafından verilebilir!',
          byPlayer.id, 0xFF0000, 'normal', 1
        );
      }
      return;
    }

    if (changedPlayer.admin) {
      const loggedUser = this.rm.authManager?.getLoggedInUser(changedPlayer.id);
      if (!loggedUser?.isAdmin) {
        this.rm.room.setPlayerAdmin(changedPlayer.id, false);
      }
    }
  },

  onPlayerTeamChange(changedPlayer, byPlayer) {
    if (!changedPlayer) return;

    const changedByBot = !byPlayer || byPlayer.id === 0;
    const selfChange = byPlayer && byPlayer.id === changedPlayer.id;
    const isAdmin = byPlayer && this.rm.playerCommands?.isAdmin({ id: byPlayer.id });

    if (selfChange && !isAdmin && !changedByBot) {
      if (this.rm.state.isCaptainMode()) {
        this.rm.safeSetTeam(changedPlayer.id, Team.SPECTATORS);
        this.rm.room.sendAnnouncement(
          'Kaptan seçimi sırasında takım değiştiremezsin!',
          changedPlayer.id, 0xFF0000, 'normal', 1
        );
        return;
      }

      if (this.rm.state.gameInProgress && this.rm.state.currentMap !== MAPS.TRAINING) {
        this.rm.safeSetTeam(changedPlayer.id, Team.SPECTATORS);
        this.rm.room.sendAnnouncement(
          'Oyun devam ederken takım değiştiremezsin!',
          changedPlayer.id, 0xFF0000, 'normal', 1
        );
        return;
      }

      if (this.rm.state.mode === GameMode.ROTATING) {
        this.rm.safeSetTeam(changedPlayer.id, Team.SPECTATORS);
        return;
      }
    }

    this.rm.logger.playerTeamChange(changedPlayer, byPlayer);

    if (changedPlayer.team === Team.RED || changedPlayer.team === Team.BLUE) {
      if (this.rm.state.mode !== GameMode.ROTATING && this.rm.playerActivity.isAFK(changedPlayer.id)) {
        this.rm.safeSetTeam(changedPlayer.id, Team.SPECTATORS);
        return;
      }
      this.rm.playerActivity.update(changedPlayer.id);
      this.rm.gameFlow.clearPlayerWarning(changedPlayer.id);
    }

    if (this.rm.state.isCaptainMode()) {
      const captain = this.rm.state.getCurrentCaptain();
      if (captain && changedPlayer.id === captain.id &&
          changedPlayer.team === Team.SPECTATORS) {
        const captainTeam = Team.BLUE;
        const teamPlayers = this.rm.getRealPlayers().filter(p => p.team === captainTeam && p.id !== changedPlayer.id);
        if (teamPlayers.length > 0) {
          const newCaptain = teamPlayers[0];
          const remaining = this.rm.state.getRemainingSelections();
          this.rm.state.endCaptainMode();
          this.rm.state.startCaptainMode(newCaptain, remaining);
          this.rm.captainManager.showSelectionList();
          this.rm.captainManager.startCaptainTimeout();
        } else {
          this.rm.captainManager.endCaptainSelection(true);
        }
        return;
      }

      if (changedPlayer.team === Team.SPECTATORS) {
        this.rm.captainManager.showSelectionList();
      }
      return;
    }

    if (this.rm.state.mode === GameMode.ROTATING) {
      return;
    }

    if (this.rm.state.gameInProgress && changedPlayer.team === Team.SPECTATORS) {
      this.rm.timeouts.set('teamChangeBalance', () => {
        this.rm.gameFlow.checkTeamBalance();
      }, 100);
      return;
    }

    if (!this.rm.state.gameInProgress) {
      const redPlayers = this.rm.room.getPlayerList().filter(p => p.team === Team.RED);
      const bluePlayers = this.rm.room.getPlayerList().filter(p => p.team === Team.BLUE);

      if (redPlayers.length > 0 && bluePlayers.length > 0) {
        this.rm.gameFlow.scheduleBalance();
      }
    }
  },

  async onPlayerKicked(kickedPlayer, reason, ban, byPlayer) {
    if (!kickedPlayer) return;

    if (!byPlayer) return;

    const adminName = byPlayer.name || '?';
    const actionType = ban ? 'ban' : 'kick';
    console.log(`[UI-${actionType.toUpperCase()}] ${adminName} → ${kickedPlayer.name} | ${reason || '-'}`);

    const kickedAuth = this.rm.getPlayerAuthData(kickedPlayer.id);

    if (ban && kickedAuth?.auth) {
      await this.rm.banManager.ban(
        kickedPlayer.name,
        kickedAuth.auth,
        kickedAuth.conn,
        reason || 'UI ban',
        adminName
      );
    }

    if (this.rm.playerCommands?.logAdminAction) {
      await this.rm.playerCommands.logAdminAction(
        actionType,
        adminName,
        kickedPlayer.name,
        kickedAuth?.auth || null,
        reason || ''
      );
    }
  },
};
