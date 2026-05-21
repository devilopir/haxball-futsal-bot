const { Team, DURATIONS, TIMING, GameMode } = require('../utils/constants');

class CaptainManager {
  constructor(roomManager) {
    this.rm = roomManager;
    this.isMidGameReplacement = false;
    this.midGameTargetTeam = null;
    this.isDualSelection = false;
    this.dualSelectionState = null;
    this.lastListHash = null;
    this.selectionLock = false;
    this.pendingPlayerId = null;
    this.targetTeam = null;
  }

  getSpecList() {
    const activePlayers = this.rm.getActivePlayers();
    return activePlayers.filter(p =>
      p.team === Team.SPECTATORS && !this.rm.playerActivity.isAFK(p.id)
    );
  }

  getListHash(specPlayers, remaining) {
    return `${remaining}-${specPlayers.map(p => p.id).join(',')}`;
  }

  showSelectionList(force = false) {
    const captainState = this.rm.state.getCurrentCaptain();
    if (!captainState) return;

    const captain = this.rm.room.getPlayer(captainState.id);
    if (!captain) {
      this.endCaptainSelection(true);
      return;
    }

    const specPlayers = this.getSpecList();
    const remaining = this.rm.state.getRemainingSelections();

    if (specPlayers.length === 0) {
      console.log('[CAPTAIN] Seçilebilecek oyuncu kalmadı');
      if (this.isMidGameReplacement) {
        this.endMidGameSelection();
      } else {
        this.endCaptainSelection();
        this.rm.timeouts.set('startAfterCaptain', () => {
          this.rm.safeStartGame();
        }, 500);
      }
      return;
    }

    if (this.isMidGameReplacement && specPlayers.length <= remaining) {
      specPlayers.forEach(p => this.rm.safeSetTeam(p.id, this.midGameTargetTeam));
      this.endMidGameSelection();
      return;
    }

    if (!this.isMidGameReplacement) {
      const { playersPerTeam } = this.rm.getGameConfig();
      const allPlayers = this.rm.getActivePlayers();
      const redCount = allPlayers.filter(p => p.team === Team.RED).length;
      const blueCount = allPlayers.filter(p => p.team === Team.BLUE).length;

      if (redCount >= playersPerTeam && blueCount >= playersPerTeam) {
        this.endCaptainSelection();
        this.rm.timeouts.set('startAfterCaptain', () => {
          this.rm.safeStartGame();
        }, 500);
        return;
      }

      const redNeed = Math.max(0, playersPerTeam - redCount);
      const blueNeed = Math.max(0, playersPerTeam - blueCount);
      const totalNeed = redNeed + blueNeed;

      if (specPlayers.length > 0 && specPlayers.length <= totalNeed) {
        let idx = 0;
        for (let i = 0; i < redNeed && idx < specPlayers.length; i++) {
          this.rm.safeSetTeam(specPlayers[idx++].id, Team.RED);
        }
        for (let i = 0; i < blueNeed && idx < specPlayers.length; i++) {
          this.rm.safeSetTeam(specPlayers[idx++].id, Team.BLUE);
        }
        this.endCaptainSelection();
        this.rm.timeouts.set('startAfterCaptain', () => {
          this.rm.safeStartGame();
        }, 500);
        return;
      }
    }

    const currentHash = this.getListHash(specPlayers, remaining);
    if (!force && this.lastListHash === currentHash) return;
    this.lastListHash = currentHash;

    const playerList = specPlayers.map((p, idx) => `${p.name} : ${idx + 1}`).join('  ');
    const listLine = `${playerList}  ya da random`;

    const selectingTeam = this.isMidGameReplacement ? this.midGameTargetTeam : (this.targetTeam || captain.team);
    const isRed = selectingTeam === Team.RED;
    const teamColor = isRed ? 0xE56E56 : 0x5689E5;
    const headerLine = isRed ? '🔴 Red Seçiyor' : '🔵 Blue Seçiyor';

    if (this.isMidGameReplacement) {
      const teamPlayers = this.rm.getRealPlayers().filter(p => p.team === this.midGameTargetTeam);
      teamPlayers.forEach(p => {
        this.rm.room.sendAnnouncement(headerLine, p.id, teamColor, 'bold', 0);
        this.rm.room.sendAnnouncement(listLine, p.id, teamColor, 'normal', 0);
      });
    } else {
      this.rm.room.sendAnnouncement(headerLine, captain.id, teamColor, 'bold', 0);
      this.rm.room.sendAnnouncement(listLine, captain.id, teamColor, 'normal', 0);
      if (captain.team === Team.RED || captain.team === Team.BLUE) {
        const teammates = this.rm.getRealPlayers().filter(p =>
          p.team === captain.team && p.id !== captain.id
        );
        teammates.forEach(p => {
          this.rm.room.sendAnnouncement(headerLine, p.id, teamColor, 'bold', 0);
          this.rm.room.sendAnnouncement(listLine, p.id, teamColor, 'normal', 0);
        });
      }
    }
  }

  refreshList() {
    if (!this.rm.state.isCaptainMode()) return;
    this.showSelectionList();
  }

  startCaptainSelection(captain, specPlayers, neededCount, targetTeam = Team.BLUE) {
    if (!specPlayers || specPlayers.length === 0) {
      this.rm.gameFlow.scheduleBalance();
      return;
    }

    const freshSpecList = this.getSpecList();

    if (freshSpecList.length === 0) {
      this.rm.gameFlow.scheduleBalance();
      return;
    }

    if (freshSpecList.length <= neededCount) {
      freshSpecList.forEach(p => this.rm.safeSetTeam(p.id, targetTeam));
      this.rm.timeouts.set('startAfterAutoFill', () => {
        this.rm.state.mode = GameMode.IDLE;
        this.rm.safeStartGame();
      }, TIMING.BALANCE_DELAY);
      return;
    }

    this.targetTeam = targetTeam;
    this.rm.state.startCaptainMode(captain, neededCount);
    this.showSelectionList();
    this.startCaptainTimeout();
  }

  startMidGameSelection(captain, specPlayers, neededCount, targetTeam) {
    if (!specPlayers || specPlayers.length === 0) {
      this.rm.room.pauseGame(false);
      return;
    }

    const freshSpecList = this.getSpecList();

    if (freshSpecList.length <= neededCount) {
      freshSpecList.forEach(p => this.rm.safeSetTeam(p.id, targetTeam));
      this.rm.room.pauseGame(false);
      return;
    }

    this.isMidGameReplacement = true;
    this.midGameTargetTeam = targetTeam;

    this.rm.state.startCaptainMode(captain, neededCount);
    this.showSelectionList();
    this.startMidGameTimeout();
  }

  startDualTeamSelection(firstCaptain, specPlayers, redNeeded, blueNeeded, bluePlayers) {
    if (!specPlayers || specPlayers.length === 0) {
      this.rm.room.pauseGame(false);
      return;
    }

    const freshSpecList = this.getSpecList();
    const totalNeeded = redNeeded + blueNeeded;

    if (freshSpecList.length <= totalNeeded) {
      let idx = 0;
      for (let i = 0; i < redNeeded && idx < freshSpecList.length; i++) {
        this.rm.safeSetTeam(freshSpecList[idx++].id, Team.RED);
      }
      for (let i = 0; i < blueNeeded && idx < freshSpecList.length; i++) {
        this.rm.safeSetTeam(freshSpecList[idx++].id, Team.BLUE);
      }
      this.rm.room.pauseGame(false);
      return;
    }

    this.isDualSelection = true;
    this.isMidGameReplacement = true;
    this.midGameTargetTeam = Team.RED;

    this.dualSelectionState = {
      phase: 'red',
      redNeeded,
      blueNeeded,
      redCaptain: firstCaptain,
      blueCaptain: bluePlayers[0],
      redSelected: 0,
      blueSelected: 0
    };

    this.rm.state.startCaptainMode(firstCaptain, redNeeded);
    this.showSelectionList();
    this.startMidGameTimeout();
  }

  continueDualSelection() {
    if (!this.isDualSelection || !this.dualSelectionState) {
      this.endMidGameSelection();
      return;
    }

    const state = this.dualSelectionState;

    if (state.phase === 'red' && state.redSelected >= state.redNeeded) {
      state.phase = 'blue';
      this.midGameTargetTeam = Team.BLUE;

      const blueCaptain = state.blueCaptain;
      if (!blueCaptain) {
        this.endMidGameSelection();
        return;
      }

      const activePlayers = this.rm.getActivePlayers();
      const specPlayers = activePlayers.filter(p =>
        p.team === Team.SPECTATORS && !this.rm.playerActivity.isAFK(p.id)
      );

      if (specPlayers.length === 0 || state.blueNeeded === 0) {
        this.endMidGameSelection();
        return;
      }

      this.rm.state.startCaptainMode(blueCaptain, state.blueNeeded);
      this.showSelectionList();
      this.startMidGameTimeout();
    } else if (state.phase === 'blue' && state.blueSelected >= state.blueNeeded) {
      this.endMidGameSelection();
    }
  }

  startMidGameTimeout() {
    this.rm.timeouts.clear('captain');
    this.rm.timeouts.clear('captainWarning');

    const warningTime = 10000;
    const totalTime = 20000;

    this.rm.timeouts.set('captainWarning', () => {
      if (!this.rm.state.isCaptainMode()) return;

      const captainState = this.rm.state.getCurrentCaptain();
      if (captainState) {
        const captain = this.rm.room.getPlayer(captainState.id);
        if (captain) {
          this.rm.room.sendAnnouncement(
            `${captain.name}, 10 saniye içinde seçim yap!`,
            null, 0xFF0000, 'bold', 2
          );
        }
      }
    }, warningTime);

    this.rm.timeouts.set('captain', () => {
      if (!this.rm.state.isCaptainMode()) return;
      this.handleMidGameCaptainTimeout();
    }, totalTime);
  }

  handleMidGameCaptainTimeout() {
    const captainState = this.rm.state.getCurrentCaptain();
    const oldCaptain = captainState ? this.rm.room.getPlayer(captainState.id) : null;
    const remaining = this.rm.state.getRemainingSelections();

    if (oldCaptain) {
      this.rm.safeKickPlayer(oldCaptain.id, "Süre doldu, seçim yapmadın!", false);
    }

    const targetTeam = this.midGameTargetTeam;
    const activePlayers = this.rm.getActivePlayers();
    const specPlayers = this.getSpecList();

    const teamPlayers = activePlayers.filter(p =>
      p.team === targetTeam &&
      !this.rm.playerActivity.isAFK(p.id)
    );

    let newCaptain = null;

    if (teamPlayers.length > 0) {
      newCaptain = teamPlayers[0];
    } else if (specPlayers.length > remaining) {
      newCaptain = specPlayers[0];
      this.rm.safeSetTeam(newCaptain.id, targetTeam);
    }

    if (newCaptain) {
      this.rm.room.sendAnnouncement(
        `⏰ Yeni kaptan: ${newCaptain.name}`,
        null, 0xFFFF00, 'bold', 1
      );

      this.rm.state.startCaptainMode(newCaptain, remaining);
      this.showSelectionList(true);
      this.startMidGameTimeout();
    } else {
      this.autoSelectForMidGame();
    }
  }

  autoSelectForMidGame() {
    const specPlayers = this.getSpecList();
    const remaining = this.rm.state.getRemainingSelections();
    const targetTeam = this.midGameTargetTeam;
    const teamName = targetTeam === Team.RED ? 'kırmızıya' : 'maviye';

    let addedCount = 0;
    for (let i = 0; i < remaining && i < specPlayers.length; i++) {
      const player = specPlayers[i];
      if (!player) continue;
      addedCount++;
      console.log(`[CAPTAIN_AUTO] ${player.name} -> ${teamName}`);
      this.rm.safeSetTeam(player.id, targetTeam);
    }

    if (this.isDualSelection && this.dualSelectionState) {
      if (this.dualSelectionState.phase === 'red') {
        this.dualSelectionState.redSelected += addedCount;
      } else {
        this.dualSelectionState.blueSelected += addedCount;
      }
      this.continueDualSelection();
    } else {
      this.endMidGameSelection();
    }
  }

  endMidGameSelection() {
    this.rm.state.endCaptainMode();
    this.rm.timeouts.clear('captain');
    this.rm.timeouts.clear('captainWarning');
    this.isMidGameReplacement = false;
    this.midGameTargetTeam = null;
    this.isDualSelection = false;
    this.dualSelectionState = null;
    this.selectionLock = false;
    this.pendingPlayerId = null;
    this.targetTeam = null;

    this.rm.room.pauseGame(false);
  }

  startCaptainTimeout() {
    this.rm.timeouts.clear('captain');
    this.rm.timeouts.clear('captainWarning');

    const warningTime = Math.floor(DURATIONS.CAPTAIN_TIMEOUT / 2);

    this.rm.timeouts.set('captainWarning', () => {
      if (this.rm.state.gameInProgress && !this.isMidGameReplacement) return;
      if (!this.rm.state.isCaptainMode()) return;

      const captainState = this.rm.state.getCurrentCaptain();
      if (captainState) {
        const captain = this.rm.room.getPlayer(captainState.id);
        if (captain) {
          const remainingSec = Math.ceil(warningTime / 1000);
          const kickEnabled = this.rm.playerCommands?.isAfkKickEnabled() ?? true;
          const suffix = kickEnabled ? 'yoksa atılacaksın!' : 'yoksa otomatik doldurulacak!';
          this.rm.room.sendAnnouncement(
            `${captain.name}, ${remainingSec} saniye içinde seçim yap ${suffix}`,
            null, 0xFF0000, 'bold', 2
          );
        }
      }
    }, warningTime);

    this.rm.timeouts.set('captain', () => {
      if (this.rm.state.gameInProgress && !this.isMidGameReplacement) {
        this.rm.state.endCaptainMode();
        this.rm.timeouts.clear('captain');
        this.rm.timeouts.clear('captainWarning');
        if (this.rm.state.mode === GameMode.ROTATING) {
          this.rm.state.mode = GameMode.IDLE;
        }
        this.isMidGameReplacement = false;
        this.midGameTargetTeam = null;
        return;
      }

      if (this.rm.state.isCaptainMode()) {
        const captainState = this.rm.state.getCurrentCaptain();
        if (captainState) {
          const captain = this.rm.room.getPlayer(captainState.id);
          if (captain) {
            const kickEnabled = this.rm.playerCommands?.isAfkKickEnabled() ?? true;
            if (kickEnabled) {
              console.log(`[CAPTAIN_TIMEOUT] ${captain.name} süresinde seçim yapmadı`);
              this.rm.safeKickPlayer(captain.id, "Süre doldu, seçim yapmadı!", false);
            } else {
              console.log(`[CAPTAIN_TIMEOUT] ${captain.name} süresinde seçim yapmadı (kick kapalı)`);
              this.rm.room.sendAnnouncement(
                `⏰ ${captain.name} seçim yapmadı, otomatik doldurma yapılıyor...`,
                null, 0xFF6600, 'bold', 1
              );
            }
          }
        }
        this.rm.state.endCaptainMode();
        this.rm.timeouts.clear('captain');
        this.rm.timeouts.clear('captainWarning');

        if (this.rm.state.mode === GameMode.ROTATING) {
          this.rm.state.mode = GameMode.IDLE;
        }

        const { playersPerTeam } = this.rm.getGameConfig();
        const allPlayers = this.rm.getActivePlayers();
        const redCount = allPlayers.filter(p => p.team === Team.RED).length;
        const blueCount = allPlayers.filter(p => p.team === Team.BLUE).length;
        const specPlayers = allPlayers.filter(p => p.team === Team.SPECTATORS && !this.rm.playerActivity.isAFK(p.id));

        const redNeed = Math.max(0, playersPerTeam - redCount);
        const blueNeed = Math.max(0, playersPerTeam - blueCount);
        const totalNeed = redNeed + blueNeed;

        if (specPlayers.length > 0 && specPlayers.length <= totalNeed) {
          let idx = 0;
          for (let i = 0; i < redNeed && idx < specPlayers.length; i++) {
            this.rm.safeSetTeam(specPlayers[idx++].id, Team.RED);
          }
          for (let i = 0; i < blueNeed && idx < specPlayers.length; i++) {
            this.rm.safeSetTeam(specPlayers[idx++].id, Team.BLUE);
          }
        }

        this.rm.timeouts.set('checkAfterTimeout', () => {
          const updatedPlayers = this.rm.getActivePlayers();
          const updatedRed = updatedPlayers.filter(p => p.team === Team.RED).length;
          const updatedBlue = updatedPlayers.filter(p => p.team === Team.BLUE).length;

          if (updatedRed >= 1 && updatedBlue >= 1 && updatedRed === updatedBlue) {
            this.rm.safeStartGame();
          } else {
            this.rm.gameFlow.scheduleBalance();
          }
        }, 300);
      }
    }, DURATIONS.CAPTAIN_TIMEOUT);
  }

  endCaptainSelection(fillBlueFromSpec = false) {
    this.rm.state.endCaptainMode();
    this.rm.timeouts.clear('captain');
    this.rm.timeouts.clear('captainWarning');
    this.rm.timeouts.clear('captainTeamCheck');
    this.rm.timeouts.clear('startAfterCaptain');
    this.selectionLock = false;
    this.pendingPlayerId = null;
    this.targetTeam = null;

    if (!this.isMidGameReplacement && this.rm.state.mode === GameMode.ROTATING) {
      this.rm.state.mode = GameMode.IDLE;
    }

    if (this.isMidGameReplacement) {
      this.isMidGameReplacement = false;
      this.midGameTargetTeam = null;
      this.rm.room.pauseGame(false);
      return;
    }

    if (fillBlueFromSpec) {
      const activePlayers = this.rm.getActivePlayers();
      const redPlayers = activePlayers.filter(p => p.team === Team.RED);
      const bluePlayers = activePlayers.filter(p => p.team === Team.BLUE);
      const specPlayers = activePlayers.filter(p =>
        p.team === Team.SPECTATORS && !this.rm.playerActivity.isAFK(p.id)
      );

      const neededForBlue = redPlayers.length - bluePlayers.length;

      if (neededForBlue > 0 && specPlayers.length > 0) {
        for (let i = 0; i < neededForBlue && i < specPlayers.length; i++) {
          const player = specPlayers[i];
          if (!player) continue;
          this.rm.safeSetTeam(player.id, Team.BLUE);
        }
      }

      const updatedActivePlayers = this.rm.getActivePlayers();
      const updatedRedCount = updatedActivePlayers.filter(p => p.team === Team.RED).length;
      const updatedBlueCount = updatedActivePlayers.filter(p => p.team === Team.BLUE).length;

      if (updatedRedCount >= 1 && updatedBlueCount >= 1 && updatedRedCount === updatedBlueCount) {
        this.rm.timeouts.set('startAfterCaptain', () => {
          this.rm.safeStartGame();
        }, TIMING.GAME_START_DELAY);
      } else {
        this.rm.gameFlow.scheduleBalance();
      }
    }
  }

  handleCaptainChoice(player, message) {
    try {
      const captainState = this.rm.state.getCurrentCaptain();

      if (!this.rm.state.isCaptainMode() || !captainState) {
        return true;
      }

      const captain = this.rm.room.getPlayer(captainState.id);

      if (!captain) {
        if (this.isMidGameReplacement) {
          this.autoSelectForMidGame();
        } else {
          this.endCaptainSelection(true);
        }
        return false;
      }

      const isCapitan = player.id === captain.id;
      const isCaptainTeammate = captain.team !== Team.SPECTATORS &&
                                 player.team === captain.team;

      if (!isCapitan && !isCaptainTeammate) {
        return true;
      }

      const activePlayers = this.rm.getActivePlayers();
      const specPlayers = activePlayers.filter(p =>
        p.team === Team.SPECTATORS && !this.rm.playerActivity.isAFK(p.id)
      );

      if (specPlayers.length === 0) {
        console.log('[CAPTAIN] Seçilebilecek oyuncu kalmadı');
        if (this.isMidGameReplacement) {
          this.endMidGameSelection();
        } else {
          this.endCaptainSelection();
          this.rm.timeouts.set('startAfterCaptain', () => {
            this.rm.safeStartGame();
          }, 500);
        }
        return false;
      }

      const input = message.trim().toLowerCase();
      let selectedPlayer = null;

      if (input === 'random' || input === 'r' || input === 'rastgele') {
        const randomIndex = Math.floor(Math.random() * specPlayers.length);
        selectedPlayer = specPlayers[randomIndex];
      } else {
        const choice = parseInt(input);
        if (!isNaN(choice) && choice >= 1 && choice <= specPlayers.length) {
          selectedPlayer = specPlayers[choice - 1];
        } else {
          const matches = specPlayers.filter(p =>
            p.name.toLowerCase().startsWith(input)
          );

          if (matches.length === 1) {
            selectedPlayer = matches[0];
          } else if (matches.length > 1) {
            const exactMatch = matches.find(p => p.name.toLowerCase() === input);
            if (exactMatch) {
              selectedPlayer = exactMatch;
            } else {
              this.rm.room.sendAnnouncement(
                `Birden fazla eşleşme: ${matches.map(p => p.name).join(', ')}`,
                player.id, 0xFF6600, 'normal', 1
              );
              return false;
            }
          }
        }
      }

      if (!selectedPlayer) {
        if (this.isMidGameReplacement) {
          this.startMidGameTimeout();
        } else {
          this.startCaptainTimeout();
        }
        return true;
      }

      if (this.selectionLock || this.pendingPlayerId === selectedPlayer.id) {
        this.rm.room.sendAnnouncement(
          'Bu oyuncu zaten seçiliyor!',
          player.id, 0xFF6600, 'normal', 1
        );
        return false;
      }

      const currentPlayer = this.rm.room.getPlayer(selectedPlayer.id);
      if (!currentPlayer || currentPlayer.team !== Team.SPECTATORS) {
        this.rm.room.sendAnnouncement(
          'Bu oyuncu artık seçilebilir değil!',
          player.id, 0xFF6600, 'normal', 1
        );
        this.showSelectionList();
        return false;
      }

      this.selectionLock = true;
      this.pendingPlayerId = selectedPlayer.id;

      this.rm.timeouts.clear('captain');
      this.rm.timeouts.clear('captainWarning');

      const targetTeam = this.isMidGameReplacement ? this.midGameTargetTeam : this.targetTeam;

      const { playersPerTeam } = this.rm.getGameConfig();
      const currentTeamCount = this.rm.getRealPlayers().filter(p => p.team === targetTeam).length;
      if (currentTeamCount >= playersPerTeam) {
        this.selectionLock = false;
        this.pendingPlayerId = null;
        console.log(`[CAPTAIN] Hedef takım zaten dolu (${currentTeamCount}/${playersPerTeam}), seçim sonlandırılıyor`);
        if (this.isMidGameReplacement) {
          this.endMidGameSelection();
        } else {
          this.endCaptainSelection();
          this.rm.timeouts.set('startAfterCaptain', () => {
            this.rm.safeStartGame();
          }, 500);
        }
        return false;
      }

      const success = this.rm.safeSetTeam(selectedPlayer.id, targetTeam);

      this.selectionLock = false;
      this.pendingPlayerId = null;

      if (!success) {
        this.rm.room.sendAnnouncement(
          'Oyuncu takıma eklenemedi!',
          player.id, 0xFF0000, 'normal', 1
        );
        if (this.isMidGameReplacement) {
          this.startMidGameTimeout();
        } else {
          this.startCaptainTimeout();
        }
        return false;
      }

      this.rm.state.addSelectedPlayer(selectedPlayer);

      const teamName = targetTeam === Team.RED ? 'Red' : 'Blue';
      console.log(`[CAPTAIN_SELECT] ${selectedPlayer.name} -> ${teamName}`);

      if (this.isMidGameReplacement) {
        if (this.isDualSelection && this.dualSelectionState) {
          if (this.dualSelectionState.phase === 'red') {
            this.dualSelectionState.redSelected++;
          } else {
            this.dualSelectionState.blueSelected++;
          }
        }

        this.rm.timeouts.set('midGameCheck', () => {
          if (this.rm.state.getRemainingSelections() > 0) {
            this.showSelectionList();
            this.startMidGameTimeout();
          } else if (this.isDualSelection) {
            this.continueDualSelection();
          } else {
            this.endMidGameSelection();
          }
        }, 300);
      } else {
        this.rm.timeouts.set('captainTeamCheck', () => {
          if (this.rm.state.gameInProgress) return;

          const currentActivePlayers = this.rm.getActivePlayers();
          const blueCount = currentActivePlayers.filter(p => p.team === Team.BLUE).length;
          const redCount = currentActivePlayers.filter(p => p.team === Team.RED).length;
          const specCount = this.getSpecList().length;
          const { playersPerTeam } = this.rm.getGameConfig();

          const redNeed = Math.max(0, playersPerTeam - redCount);
          const blueNeed = Math.max(0, playersPerTeam - blueCount);

          if (redCount >= playersPerTeam && blueCount >= playersPerTeam) {
            this.endCaptainSelection();
            this.rm.safeStartGame();
          } else if (specCount > 0 && (redNeed > 0 || blueNeed > 0)) {
            const currentTargetTeam = this.targetTeam;
            const currentTargetCount = currentTargetTeam === Team.RED ? redCount : blueCount;
            if (currentTargetCount >= playersPerTeam) {
              console.log(`[CAPTAIN] Hedef takım dolu, seçim sonlandırılıyor`);
              this.endCaptainSelection();
              this.rm.gameFlow.scheduleBalance();
              return;
            }
            this.showSelectionList();
            this.startCaptainTimeout();
          } else {
            this.endCaptainSelection();
            if (redCount >= 1 && blueCount >= 1) {
              this.rm.safeStartGame();
            } else {
              this.rm.gameFlow.scheduleBalance();
            }
          }
        }, 100);
      }

      return false;
    } catch (e) {
      console.error('[handleCaptainChoice] Hata:', e.message);
      return true;
    }
  }
}

module.exports = CaptainManager;
