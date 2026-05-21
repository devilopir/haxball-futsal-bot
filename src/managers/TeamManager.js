const { Team } = require('../utils/constants');

class TeamManager {
  constructor(roomManager) {
    this.rm = roomManager;
  }

  getTeamPlayers(teamId) {
    if (teamId !== Team.RED && teamId !== Team.BLUE && teamId !== Team.SPECTATORS) {
      return [];
    }
    return this.rm.getRealPlayers().filter(p => p.team === teamId);
  }

  movePlayersToTeams(redPlayers, bluePlayers, specPlayers) {
    const results = { success: 0, failed: 0 };

    this.rm.getRealPlayers()
      .filter(p => p && this.rm.playerActivity.isAFK(p.id))
      .forEach(p => {
        this.rm.safeSetTeam(p.id, Team.SPECTATORS);
      });

    (redPlayers || []).forEach(p => {
      if (p && p.id !== undefined) {
        if (this.rm.safeSetTeam(p.id, Team.RED)) results.success++;
        else results.failed++;
      }
    });

    (bluePlayers || []).forEach(p => {
      if (p && p.id !== undefined) {
        if (this.rm.safeSetTeam(p.id, Team.BLUE)) results.success++;
        else results.failed++;
      }
    });

    (specPlayers || []).forEach(p => {
      if (p && p.id !== undefined) {
        if (this.rm.safeSetTeam(p.id, Team.SPECTATORS)) results.success++;
        else results.failed++;
      }
    });

    return results;
  }

  distributePlayersPreserveTeams(activePlayers, playersPerTeam) {
    if (!Array.isArray(activePlayers) || playersPerTeam < 1) {
      return { redToMove: [], blueToMove: [], finalSpec: [] };
    }

    const nonAFKPlayers = activePlayers.filter(p => p && !this.rm.playerActivity.isAFK(p.id));
    const afkPlayers = activePlayers.filter(p => p && this.rm.playerActivity.isAFK(p.id));

    const currentRed = nonAFKPlayers.filter(p => p.team === Team.RED);
    const currentBlue = nonAFKPlayers.filter(p => p.team === Team.BLUE);
    const currentSpec = nonAFKPlayers.filter(p => p.team === Team.SPECTATORS);

    const redToMove = [];
    const blueToMove = [];
    const specToMove = [];

    for (let i = 0; i < currentRed.length; i++) {
      if (i < playersPerTeam) {
        redToMove.push(currentRed[i]);
      } else {
        specToMove.push(currentRed[i]);
      }
    }

    for (let i = 0; i < currentBlue.length; i++) {
      if (i < playersPerTeam) {
        blueToMove.push(currentBlue[i]);
      } else {
        specToMove.push(currentBlue[i]);
      }
    }

    const remainingSpec = [...specToMove, ...currentSpec];

    while (redToMove.length < playersPerTeam && remainingSpec.length > 0) {
      redToMove.push(remainingSpec.shift());
    }

    while (blueToMove.length < playersPerTeam && remainingSpec.length > 0) {
      blueToMove.push(remainingSpec.shift());
    }

    return { redToMove, blueToMove, finalSpec: [...remainingSpec, ...afkPlayers] };
  }

  distributePlayersFresh(activePlayers, playersPerTeam) {
    if (!Array.isArray(activePlayers) || playersPerTeam < 1) {
      return { redToMove: [], blueToMove: [], finalSpec: [] };
    }

    const nonAFKPlayers = activePlayers.filter(p => p && !this.rm.playerActivity.isAFK(p.id));
    const afkPlayers = activePlayers.filter(p => p && this.rm.playerActivity.isAFK(p.id));
    const redToMove = [];
    const blueToMove = [];
    const specToMove = [];

    for (let i = 0; i < playersPerTeam && i < nonAFKPlayers.length; i++) {
      redToMove.push(nonAFKPlayers[i]);
    }

    for (let i = playersPerTeam; i < playersPerTeam * 2 && i < nonAFKPlayers.length; i++) {
      blueToMove.push(nonAFKPlayers[i]);
    }

    for (let i = playersPerTeam * 2; i < nonAFKPlayers.length; i++) {
      specToMove.push(nonAFKPlayers[i]);
    }

    return { redToMove, blueToMove, finalSpec: [...specToMove, ...afkPlayers] };
  }

  balanceTeams(preserveTeams = true) {
    const activePlayers = this.rm.getActivePlayers();
    const totalPlayers = activePlayers.length;

    if (totalPlayers === 0) return;

    if (totalPlayers === 1) {
      const player = activePlayers[0];
      if (player && player.id !== undefined) {
        this.rm.safeSetTeam(player.id, Team.RED);
      }
      this.rm.getRealPlayers()
        .filter(p => p && this.rm.playerActivity.isAFK(p.id))
        .forEach(p => {
          this.rm.safeSetTeam(p.id, Team.SPECTATORS);
        });
      return;
    }

    const targetMap = this.rm.getMapForPlayerCount(totalPlayers);
    const playersPerTeam = this.rm.getPlayersPerTeam(targetMap, totalPlayers);

    if (playersPerTeam < 1) return;

    let distribution;
    if (preserveTeams) {
      distribution = this.distributePlayersPreserveTeams(activePlayers, playersPerTeam);
    } else {
      distribution = this.distributePlayersFresh(activePlayers, playersPerTeam);
    }

    this.movePlayersToTeams(distribution.redToMove, distribution.blueToMove, distribution.finalSpec);
  }

  shuffleTeams() {
    const players = this.rm.getActivePlayers().filter(p => p && p.team !== Team.SPECTATORS);
    const totalPlayers = players.length;

    if (totalPlayers < 2) return;

    for (let i = players.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [players[i], players[j]] = [players[j], players[i]];
    }

    const playersPerTeam = Math.floor(totalPlayers / 2);

    for (let i = 0; i < playersPerTeam; i++) {
      if (players[i] && players[i].id !== undefined) {
        this.rm.safeSetTeam(players[i].id, Team.RED);
      }
    }

    for (let i = playersPerTeam; i < playersPerTeam * 2; i++) {
      if (players[i] && players[i].id !== undefined) {
        this.rm.safeSetTeam(players[i].id, Team.BLUE);
      }
    }

    this.rm.getRealPlayers()
      .filter(p => p && this.rm.playerActivity.isAFK(p.id))
      .forEach(p => {
        this.rm.safeSetTeam(p.id, Team.SPECTATORS);
      });
  }
}

module.exports = TeamManager;
