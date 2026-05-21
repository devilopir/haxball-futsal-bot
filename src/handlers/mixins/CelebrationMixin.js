const { Team, CELEBRATION } = require('../../utils/constants');
const MAPS = require('../../../maps');

const PIXEL_FONT = {
  A:[1,1,1,1,0,1,1,1,1,1,0,1,1,0,1],B:[1,1,0,1,0,1,1,1,0,1,0,1,1,1,0],C:[0,1,1,1,0,0,1,0,0,1,0,0,0,1,1],
  D:[1,1,0,1,0,1,1,0,1,1,0,1,1,1,0],E:[1,1,1,1,0,0,1,1,0,1,0,0,1,1,1],F:[1,1,1,1,0,0,1,1,0,1,0,0,1,0,0],
  G:[0,1,1,1,0,0,1,0,1,1,0,1,0,1,1],H:[1,0,1,1,0,1,1,1,1,1,0,1,1,0,1],I:[1,1,1,0,1,0,0,1,0,0,1,0,1,1,1],
  J:[1,1,1,0,0,1,0,0,1,1,0,1,0,1,0],K:[1,0,1,1,1,0,1,0,0,1,1,0,1,0,1],L:[1,0,0,1,0,0,1,0,0,1,0,0,1,1,1],
  M:[1,0,1,1,1,1,1,1,1,1,0,1,1,0,1],N:[1,0,1,1,1,1,1,1,1,1,1,1,1,0,1],O:[0,1,0,1,0,1,1,0,1,1,0,1,0,1,0],
  P:[1,1,0,1,0,1,1,1,0,1,0,0,1,0,0],R:[1,1,0,1,0,1,1,1,0,1,0,1,1,0,1],S:[0,1,1,1,0,0,0,1,0,0,0,1,1,1,0],
  T:[1,1,1,0,1,0,0,1,0,0,1,0,0,1,0],U:[1,0,1,1,0,1,1,0,1,1,0,1,0,1,0],V:[1,0,1,1,0,1,1,0,1,0,1,0,0,1,0],
  W:[1,0,1,1,0,1,1,1,1,1,1,1,1,0,1],X:[1,0,1,1,0,1,0,1,0,1,0,1,1,0,1],Y:[1,0,1,1,0,1,0,1,0,0,1,0,0,1,0],
  Z:[1,1,1,0,0,1,0,1,0,1,0,0,1,1,1],
  0:[0,1,0,1,0,1,1,0,1,1,0,1,0,1,0],1:[0,1,0,1,1,0,0,1,0,0,1,0,1,1,1],2:[1,1,0,0,0,1,0,1,0,1,0,0,1,1,1],
  3:[1,1,0,0,0,1,0,1,0,0,0,1,1,1,0],4:[1,0,1,1,0,1,1,1,1,0,0,1,0,0,1],5:[1,1,1,1,0,0,1,1,0,0,0,1,1,1,0],
  6:[0,1,1,1,0,0,1,1,1,1,0,1,0,1,1],7:[1,1,1,0,0,1,0,1,0,0,1,0,0,1,0],8:[0,1,0,1,0,1,0,1,0,1,0,1,0,1,0],
  9:[0,1,0,1,0,1,0,1,1,0,0,1,0,1,0],
  '!':[0,1,0,0,1,0,0,1,0,0,0,0,0,1,0],'?':[1,1,0,0,0,1,0,1,0,0,0,0,0,1,0],'.':[0,0,0,0,0,0,0,0,0,0,0,0,0,1,0],
  ' ':[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
};

module.exports = {
  startCelebration(playerId, team, type = 'spinning', ballPos = null, goalEffectType = 'goal_burst', goalText = null) {
    let goalEffect = null;
    if (ballPos && goalEffectType !== 'goal_text') {
      goalEffect = { x: ballPos.x, y: ballPos.y, ticksLeft: 50, type: goalEffectType };
    }
    this.activeCelebration = {
      playerId,
      team,
      type,
      angle: 0,
      ticksLeft: CELEBRATION.DURATION_TICKS,
      phase: 0,
      goalEffect,
    };
    if (ballPos && goalEffectType === 'goal_text' && goalText) {
      this._startGoalText(goalText, ballPos.x, ballPos.y, team);
    }
  },

  _startGoalText(text, x, y, team) {
    const chars = text.toUpperCase().slice(0, 5).split('');
    const pixels = [];
    let offsetX = 0;
    for (const ch of chars) {
      const glyph = PIXEL_FONT[ch];
      if (!glyph) { offsetX += 4; continue; }
      for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 3; col++) {
          if (glyph[row * 3 + col]) {
            pixels.push({ px: offsetX + col, py: row });
          }
        }
      }
      offsetX += 4;
    }
    const totalWidth = (offsetX - 1) * CELEBRATION.TEXT_PIXEL_SIZE;
    const totalHeight = 5 * CELEBRATION.TEXT_PIXEL_SIZE;
    const startX = x - totalWidth / 2;
    const startY = y - totalHeight / 2;
    const teamColor = team === Team.RED ? CELEBRATION.COLORS.RED : CELEBRATION.COLORS.BLUE;

    this.activeGoalText = {
      pixels,
      startX,
      startY,
      color: teamColor,
      ticksLeft: CELEBRATION.TEXT_DURATION_TICKS,
      totalTicks: CELEBRATION.TEXT_DURATION_TICKS,
    };

    for (let i = 0; i < CELEBRATION.TEXT_DISC_COUNT; i++) {
      if (i < pixels.length) {
        const p = pixels[i];
        try {
          this.rm.room.setDiscProperties(CELEBRATION.TEXT_DISC_START + i, {
            x: startX + p.px * CELEBRATION.TEXT_PIXEL_SIZE,
            y: startY + p.py * CELEBRATION.TEXT_PIXEL_SIZE,
            xspeed: 0, yspeed: 0,
            radius: CELEBRATION.TEXT_PIXEL_SIZE / 2,
            color: teamColor,
          });
        } catch (e) {}
      }
    }
  },

  _updateGoalText() {
    if (!this.activeGoalText) return;
    const gt = this.activeGoalText;
    gt.ticksLeft--;
    if (gt.ticksLeft <= 0) {
      this._hideGoalText();
      return;
    }
    const progress = 1 - (gt.ticksLeft / gt.totalTicks);
    const fade = progress > 0.7 ? Math.max(0, 1 - (progress - 0.7) / 0.3) : 1;
    const discSize = Math.max(0.5, (CELEBRATION.TEXT_PIXEL_SIZE / 2) * fade);
    for (let i = 0; i < gt.pixels.length && i < CELEBRATION.TEXT_DISC_COUNT; i++) {
      try {
        this.rm.room.setDiscProperties(CELEBRATION.TEXT_DISC_START + i, { radius: discSize });
      } catch (e) {}
    }
  },

  _hideGoalText() {
    for (let i = 0; i < CELEBRATION.TEXT_DISC_COUNT; i++) {
      try {
        this.rm.room.setDiscProperties(CELEBRATION.TEXT_DISC_START + i, {
          x: 0, y: 9999, radius: 0.01, color: 0x000000,
        });
      } catch (e) {}
    }
    this.activeGoalText = null;
  },

  stopCelebration() {
    this.hideCelebrationDiscs();
    this.activeCelebration = null;
    if (this.activeGoalText) this._hideGoalText();
  },

  hideCelebrationDiscs() {
    if (this.rm.state.currentMap !== MAPS.V2 && this.rm.state.currentMap !== MAPS.V3) return;
    try {
      for (let i = 0; i < CELEBRATION.DISC_COUNT; i++) {
        this.rm.room.setDiscProperties(CELEBRATION.DISC_START_INDEX + i, {
          x: 0, y: 9999, xspeed: 0, yspeed: 0, radius: 0.01, color: 0x000000,
        });
      }
    } catch (e) {}
  },

  updateCelebration() {
    if (!this.activeCelebration) return;
    if (this.rm.state.currentMap !== MAPS.V2 && this.rm.state.currentMap !== MAPS.V3) {
      this.activeCelebration = null;
      return;
    }

    const cel = this.activeCelebration;
    cel.ticksLeft--;

    if (cel.ticksLeft <= 0) {
      this.stopCelebration();
      return;
    }

    const player = this.rm.room.getPlayer(cel.playerId);
    if (!player || !player.position) {
      this.stopCelebration();
      return;
    }

    const playerDisc = this.rm.room.getPlayerDiscProperties(cel.playerId);
    const px = player.position.x;
    const py = player.position.y;
    const pxs = playerDisc?.xspeed || 0;
    const pys = playerDisc?.yspeed || 0;
    const playerRadius = playerDisc ? playerDisc.radius : 15;
    const teamColor = cel.team === Team.RED ? CELEBRATION.COLORS.RED : CELEBRATION.COLORS.BLUE;

    cel.angle += CELEBRATION.ORBIT_SPEED;
    cel.phase++;

    if (cel.goalEffect && cel.goalEffect.ticksLeft > 0) {
      this._updateGoalEffect(cel, teamColor);
      return;
    }

    if (cel.type === 'none') {
      return;
    } else if (cel.type === 'fireworks') {
      this._updateFireworks(cel, px, py, pxs, pys, playerRadius, teamColor);
    } else if (cel.type === 'shockwave') {
      this._updateShockwave(cel, px, py, pxs, pys, playerRadius, teamColor);
    } else {
      this._updateSpinning(cel, px, py, pxs, pys, playerRadius, teamColor);
    }
  },

  _updateSpinning(cel, px, py, pxs, pys, playerRadius, teamColor) {
    const isBig = playerRadius > 30;
    const activeDiscs = isBig ? CELEBRATION.DISC_COUNT : 8;
    const orbitBase = isBig ? playerRadius * CELEBRATION.ORBIT_MULTIPLIER : 38;
    const wobble = isBig ? 3 : 1;

    for (let i = 0; i < CELEBRATION.DISC_COUNT; i++) {
      if (i >= activeDiscs) {
        try { this.rm.room.setDiscProperties(CELEBRATION.DISC_START_INDEX + i, { x: 0, y: 9999, radius: 0.01, color: 0x000000 }); } catch (e) {}
        continue;
      }
      const angle = cel.angle + (i * 2 * Math.PI / activeDiscs);
      const orbitRadius = orbitBase + Math.sin(cel.angle * 3 + i) * wobble;
      const color = i % 2 === 0 ? teamColor : CELEBRATION.COLORS.GOLD;
      try {
        this.rm.room.setDiscProperties(CELEBRATION.DISC_START_INDEX + i, {
          x: px + Math.cos(angle) * orbitRadius, y: py + Math.sin(angle) * orbitRadius,
          xspeed: pxs, yspeed: pys, radius: CELEBRATION.DISC_RADIUS, color,
        });
      } catch (e) {}
    }
  },

  _updateFireworks(cel, px, py, pxs, pys, playerRadius, teamColor) {
    const totalTicks = CELEBRATION.DURATION_TICKS;
    const progress = cel.phase / totalTicks;
    const burstOut = progress < 0.3;
    const floating = progress >= 0.3 && progress < 0.7;

    let dist;
    if (burstOut) {
      dist = (cel.phase / (totalTicks * 0.3)) * 120;
    } else if (floating) {
      const floatPhase = (progress - 0.3) / 0.4;
      dist = 120 - floatPhase * 40;
    } else {
      const returnPhase = (progress - 0.7) / 0.3;
      dist = 80 * (1 - returnPhase);
    }

    for (let i = 0; i < CELEBRATION.DISC_COUNT; i++) {
      const baseAngle = (i * 2 * Math.PI / CELEBRATION.DISC_COUNT);
      const sparkle = Math.sin(cel.phase * 0.3 + i * 2) * 8;
      const r = dist + sparkle;
      const color = i % 3 === 0 ? teamColor : i % 3 === 1 ? CELEBRATION.COLORS.GOLD : 0xFFFFFF;
      const discRadius = Math.max(1, CELEBRATION.DISC_RADIUS * (1 - progress * 0.5));
      try {
        this.rm.room.setDiscProperties(CELEBRATION.DISC_START_INDEX + i, {
          x: px + Math.cos(baseAngle + cel.angle * 0.3) * r,
          y: py + Math.sin(baseAngle + cel.angle * 0.3) * r,
          xspeed: pxs, yspeed: pys, radius: discRadius, color,
        });
      } catch (e) {}
    }
  },

  _updateShockwave(cel, px, py, pxs, pys, playerRadius, teamColor) {
    const cycleLength = 60;
    const cyclePhase = (cel.phase % cycleLength) / cycleLength;
    const isBig = playerRadius > 30;
    const maxRadius = isBig ? playerRadius * 1.5 : 60;
    const minRadius = isBig ? playerRadius * 1.05 : 20;

    const expand = cyclePhase < 0.5;
    const t = expand ? cyclePhase * 2 : (1 - cyclePhase) * 2;
    const eased = t * t * (3 - 2 * t);
    const ringRadius = minRadius + (maxRadius - minRadius) * eased;

    const discAlpha = expand ? 1 : (1 - cyclePhase) * 2;
    const discSize = Math.max(1, CELEBRATION.DISC_RADIUS * discAlpha);

    for (let i = 0; i < CELEBRATION.DISC_COUNT; i++) {
      const angle = (i * 2 * Math.PI / CELEBRATION.DISC_COUNT) + cel.angle * 0.5;
      const color = i % 2 === 0 ? teamColor : CELEBRATION.COLORS.GOLD;
      try {
        this.rm.room.setDiscProperties(CELEBRATION.DISC_START_INDEX + i, {
          x: px + Math.cos(angle) * ringRadius,
          y: py + Math.sin(angle) * ringRadius,
          xspeed: pxs, yspeed: pys, radius: discSize, color,
        });
      } catch (e) {}
    }
  },

  _updateGoalEffect(cel, teamColor) {
    const ge = cel.goalEffect;
    ge.ticksLeft--;
    const progress = 1 - (ge.ticksLeft / 50);

    if (ge.type === 'goal_confetti') {
      this._goalConfetti(ge, progress, teamColor);
    } else if (ge.type === 'goal_rings') {
      this._goalRings(ge, progress, teamColor);
    } else {
      this._goalBurst(ge, progress, teamColor);
    }
  },

  _goalBurst(ge, progress, teamColor) {
    const burstRadius = progress * 80;
    const fade = 1 - progress;
    for (let i = 0; i < CELEBRATION.DISC_COUNT; i++) {
      const angle = (i * 2 * Math.PI / CELEBRATION.DISC_COUNT) + progress * 0.5;
      const color = i % 2 === 0 ? teamColor : CELEBRATION.COLORS.GOLD;
      const r = burstRadius + Math.sin(i * 1.5) * 10;
      const discSize = Math.max(1, CELEBRATION.DISC_RADIUS * 1.5 * fade);
      try {
        this.rm.room.setDiscProperties(CELEBRATION.DISC_START_INDEX + i, {
          x: ge.x + Math.cos(angle) * r, y: ge.y + Math.sin(angle) * r,
          xspeed: 0, yspeed: 0, radius: discSize, color,
        });
      } catch (e) {}
    }
  },

  _goalConfetti(ge, progress, teamColor) {
    if (!ge.seeds) {
      ge.seeds = [];
      for (let i = 0; i < CELEBRATION.DISC_COUNT; i++) {
        ge.seeds.push({
          angle: Math.random() * Math.PI * 2,
          speed: 40 + Math.random() * 60,
          drift: (Math.random() - 0.5) * 2,
          color: [teamColor, CELEBRATION.COLORS.GOLD, 0xFFFFFF, 0xFF6B6B, 0x6BCB77, 0x4D96FF][i % 6],
        });
      }
    }
    const fade = Math.max(0, 1 - progress * 1.2);
    for (let i = 0; i < CELEBRATION.DISC_COUNT; i++) {
      const s = ge.seeds[i];
      const dist = s.speed * progress;
      const gravity = progress * progress * 30;
      const discSize = Math.max(1, (2 + Math.random() * 2) * fade);
      try {
        this.rm.room.setDiscProperties(CELEBRATION.DISC_START_INDEX + i, {
          x: ge.x + Math.cos(s.angle) * dist + s.drift * progress * 20,
          y: ge.y + Math.sin(s.angle) * dist + gravity,
          xspeed: 0, yspeed: 0, radius: discSize, color: s.color,
        });
      } catch (e) {}
    }
  },

  _goalRings(ge, progress, teamColor) {
    const ringCount = 3;
    const discsPerRing = Math.floor(CELEBRATION.DISC_COUNT / ringCount);
    for (let ring = 0; ring < ringCount; ring++) {
      const ringDelay = ring * 0.25;
      const ringProgress = Math.max(0, Math.min(1, (progress - ringDelay) / (1 - ringDelay)));
      const radius = ringProgress * (50 + ring * 25);
      const fade = Math.max(0, 1 - ringProgress);
      const discSize = Math.max(1, CELEBRATION.DISC_RADIUS * fade);
      const color = ring === 1 ? CELEBRATION.COLORS.GOLD : teamColor;
      for (let i = 0; i < discsPerRing; i++) {
        const idx = ring * discsPerRing + i;
        if (idx >= CELEBRATION.DISC_COUNT) break;
        const angle = (i * 2 * Math.PI / discsPerRing) + ring * 0.3;
        try {
          this.rm.room.setDiscProperties(CELEBRATION.DISC_START_INDEX + idx, {
            x: ge.x + Math.cos(angle) * radius, y: ge.y + Math.sin(angle) * radius,
            xspeed: 0, yspeed: 0, radius: discSize, color,
          });
        } catch (e) {}
      }
    }
  },
};
