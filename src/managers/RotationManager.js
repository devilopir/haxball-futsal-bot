const { Team, GameMode, TIMING } = require('../utils/constants');

class RotationManager {
  constructor(roomManager) {
    this.rm = roomManager;
    this.oldSpecPlayerIds = [];
  }

  handleRotation(scores) {
    this.rm.state.mode = GameMode.ROTATING;

    const activePlayers = this.rm.getActivePlayers();

    this.oldSpecPlayerIds = activePlayers
      .filter(p => p.team === Team.SPECTATORS && !this.rm.playerActivity.isAFK(p.id))
      .map(p => p.id);

    const { playersPerTeam } = this.rm.getGameConfig();

    this.rm.logger.rotation('handleRotation_start', {
      scores: { red: scores.red, blue: scores.blue },
      totalActive: activePlayers.length,
      oldSpecIds: this.oldSpecPlayerIds,
      oldSpecNames: activePlayers.filter(p => this.oldSpecPlayerIds.includes(p.id)).map(p => p.name),
      playersPerTeam
    });

    if (scores.red === scores.blue) {
      this.rm.logger.rotation('handleRotation_draw_shuffle', { scores });
      this.shuffleAndStart();
      return;
    }

    const winningTeam = scores.red > scores.blue ? Team.RED : Team.BLUE;
    const losingTeam = winningTeam === Team.RED ? Team.BLUE : Team.RED;

    const winners = this.rm.teamManager.getTeamPlayers(winningTeam);
    const losers = this.rm.teamManager.getTeamPlayers(losingTeam);

    this.rm.logger.rotation('handleRotation_winner_stays', {
      winningTeam: winningTeam === Team.RED ? 'Red' : 'Blue',
      winners: winners.map(p => p.name),
      losers: losers.map(p => p.name),
      waitingSpecs: this.oldSpecPlayerIds.length
    });

    if (this.oldSpecPlayerIds.length === 0) {
      this.rm.logger.rotation('handleRotation_no_waiting_specs_shuffle');
      this.shuffleAndStart();
      return;
    }

    losers.forEach(p => this.rm.safeSetTeam(p.id, Team.SPECTATORS));
    winners.forEach(p => this.rm.safeSetTeam(p.id, Team.RED));

    this.rm.timeouts.set('rotationContinue', () => {
      this.continueRotation(playersPerTeam);
    }, TIMING.ROTATION_STEP_DELAY);
  }

  continueRotation(playersPerTeam) {
    const activePlayers = this.rm.getActivePlayers();
    const redPlayers = activePlayers.filter(p => p.team === Team.RED);

    const allSpecPlayers = activePlayers.filter(p =>
      p.team === Team.SPECTATORS && !this.rm.playerActivity.isAFK(p.id)
    );

    const sortedSpecPlayers = [
      ...allSpecPlayers.filter(p => this.oldSpecPlayerIds.includes(p.id)),
      ...allSpecPlayers.filter(p => !this.oldSpecPlayerIds.includes(p.id))
    ];

    this.rm.logger.rotation('continueRotation_start', {
      redCount: redPlayers.length,
      redNames: redPlayers.map(p => p.name),
      allSpecCount: allSpecPlayers.length,
      sortedSpecNames: sortedSpecPlayers.map(p => p.name),
      oldSpecIds: this.oldSpecPlayerIds,
      playersPerTeam
    });

    if (sortedSpecPlayers.length === 0) {
      this.rm.logger.rotation('continueRotation_no_specs_shuffle');
      this.shuffleAndStart();
      return;
    }

    const hasOldSpec = sortedSpecPlayers.some(p => this.oldSpecPlayerIds.includes(p.id));
    if (!hasOldSpec) {
      this.rm.logger.rotation('continueRotation_no_old_spec_shuffle', {
        specNames: sortedSpecPlayers.map(p => p.name)
      });
      this.shuffleAndStart();
      return;
    }

    if (redPlayers.length > playersPerTeam) {
      const excessCount = redPlayers.length - playersPerTeam;
      for (let i = 0; i < excessCount; i++) {
        const playerToMove = redPlayers[redPlayers.length - 1 - i];
        this.rm.safeSetTeam(playerToMove.id, Team.SPECTATORS);
      }
    }

    const updatedActivePlayers = this.rm.getActivePlayers();
    const updatedRedCount = updatedActivePlayers.filter(p => p.team === Team.RED).length;

    const updatedAllSpecs = updatedActivePlayers.filter(p =>
      p.team === Team.SPECTATORS && !this.rm.playerActivity.isAFK(p.id)
    );
    const updatedSortedSpecs = [
      ...updatedAllSpecs.filter(p => this.oldSpecPlayerIds.includes(p.id)),
      ...updatedAllSpecs.filter(p => !this.oldSpecPlayerIds.includes(p.id))
    ];

    if (updatedSortedSpecs.length === 0) {
      this.rm.logger.rotation('continueRotation_updated_no_specs_shuffle');
      this.shuffleAndStart();
      return;
    }

    const newCaptain = updatedSortedSpecs[0];
    this.rm.safeSetTeam(newCaptain.id, Team.BLUE);

    const remainingOldSpecIds = this.oldSpecPlayerIds.filter(id => id !== newCaptain.id);

    this.rm.logger.rotation('continueRotation_captain_assigned', {
      newCaptain: newCaptain.name,
      updatedRedCount,
      remainingOldSpecCount: remainingOldSpecIds.length
    });

    this.rm.timeouts.set('rotationCaptain', () => {
      this.setupCaptainSelection(newCaptain, updatedRedCount, remainingOldSpecIds);
    }, TIMING.ROTATION_STEP_DELAY);
  }

  setupCaptainSelection(captain, redCount, remainingOldSpecIds = []) {
    const activePlayers = this.rm.getActivePlayers();

    const allSpecPlayers = activePlayers.filter(p =>
      p.team === Team.SPECTATORS && !this.rm.playerActivity.isAFK(p.id)
    );

    const availableSpecPlayers = [
      ...allSpecPlayers.filter(p => remainingOldSpecIds.includes(p.id)),
      ...allSpecPlayers.filter(p => !remainingOldSpecIds.includes(p.id))
    ];

    const blueCount = activePlayers.filter(p => p.team === Team.BLUE).length;

    const neededCount = redCount - blueCount;

    this.rm.logger.rotation('setupCaptain_start', {
      captain: captain.name,
      redCount,
      blueCount,
      neededCount,
      availableSpecCount: availableSpecPlayers.length,
      availableSpecNames: availableSpecPlayers.map(p => p.name)
    });

    if (neededCount < 0) {
      this.rm.logger.rotation('setupCaptain_negative_need_balance', { redCount, blueCount, neededCount });
      this.rm.state.mode = GameMode.IDLE;
      this.rm.gameFlow.scheduleBalance();
      return;
    }

    if (neededCount === 0) {
      this.rm.logger.rotation('setupCaptain_teams_equal_start');
      this.rm.timeouts.set('startGame', () => {
        this.rm.state.mode = GameMode.IDLE;
        this.rm.safeStartGame();
      }, TIMING.BALANCE_DELAY);
      return;
    }

    if (availableSpecPlayers.length <= neededCount) {
      this.rm.logger.rotation('setupCaptain_autofill_all_specs', {
        needed: neededCount,
        available: availableSpecPlayers.length,
        specNames: availableSpecPlayers.map(p => p.name)
      });
      availableSpecPlayers.forEach(p => this.rm.safeSetTeam(p.id, Team.BLUE));

      const expectedBlueCount = blueCount + availableSpecPlayers.length;

      if (expectedBlueCount !== redCount) {
        this.rm.logger.rotation('setupCaptain_autofill_mismatch_balance', {
          expectedBlue: expectedBlueCount, redCount
        });
        this.rm.state.mode = GameMode.IDLE;
        this.rm.gameFlow.scheduleBalance();
        return;
      }

      this.rm.timeouts.set('startGame', () => {
        this.rm.state.mode = GameMode.IDLE;
        this.rm.safeStartGame();
      }, TIMING.BALANCE_DELAY);
      return;
    }

    this.rm.logger.rotation('setupCaptain_captain_selection', {
      captain: captain.name,
      neededCount,
      availableSpecCount: availableSpecPlayers.length
    });
    this.rm.captainManager.startCaptainSelection(captain, availableSpecPlayers, neededCount);
  }

  shuffleAndStart() {
    const activePlayers = this.rm.getActivePlayers();
    const nonAFKPlayers = activePlayers.filter(p => !this.rm.playerActivity.isAFK(p.id));

    for (let i = nonAFKPlayers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [nonAFKPlayers[i], nonAFKPlayers[j]] = [nonAFKPlayers[j], nonAFKPlayers[i]];
    }

    const { playersPerTeam } = this.rm.getGameConfig();

    for (let i = 0; i < playersPerTeam && i < nonAFKPlayers.length; i++) {
      this.rm.safeSetTeam(nonAFKPlayers[i].id, Team.RED);
    }

    for (let i = playersPerTeam; i < playersPerTeam * 2 && i < nonAFKPlayers.length; i++) {
      this.rm.safeSetTeam(nonAFKPlayers[i].id, Team.BLUE);
    }

    for (let i = playersPerTeam * 2; i < nonAFKPlayers.length; i++) {
      this.rm.safeSetTeam(nonAFKPlayers[i].id, Team.SPECTATORS);
    }

    activePlayers.filter(p => this.rm.playerActivity.isAFK(p.id))
      .forEach(p => this.rm.safeSetTeam(p.id, Team.SPECTATORS));

    this.rm.logger.rotation('shuffleAndStart', {
      totalNonAFK: nonAFKPlayers.length,
      playersPerTeam,
      red: nonAFKPlayers.slice(0, playersPerTeam).map(p => p.name),
      blue: nonAFKPlayers.slice(playersPerTeam, playersPerTeam * 2).map(p => p.name),
      spec: nonAFKPlayers.slice(playersPerTeam * 2).map(p => p.name)
    });

    this.rm.timeouts.set('shuffleStart', () => {
      this.rm.state.mode = GameMode.IDLE;
      this.rm.safeStartGame();
    }, TIMING.TEAM_SHUFFLE_DELAY);
  }
}


module.exports = RotationManager;
