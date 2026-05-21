const config = require('../../config');
const ProfanityFilter = require('../filters/ProfanityFilter');

const playerConnectionMethods = require('./mixins/PlayerConnectionMixin');
const chatMethods = require('./mixins/ChatMixin');
const gameLifecycleMethods = require('./mixins/GameLifecycleMixin');
const goalMethods = require('./mixins/GoalMixin');
const celebrationMethods = require('./mixins/CelebrationMixin');
const statsMethods = require('./mixins/StatsMixin');
const teamMethods = require('./mixins/TeamMixin');

class EventHandlers {
  constructor(roomManager) {
    this.rm = roomManager;
    this.processingJoin = false;
    this.processingLeave = false;
    this.eventQueue = [];
    this.tickCounter = 0;
    this.maxBallSpeed = 0;
    this.messageHistory = new Map();
    this.playerJoinTimes = new Map();
    this.chatTimestamps = new Map();
    this.chatWarnings = new Map();
    this.chatStyleCache = new Map();
    this.profanityFilter = new ProfanityFilter(config.moderation || {});
    this.activeCelebration = null;
    this.activeGoalText = null;
  }
}

Object.assign(EventHandlers.prototype,
  playerConnectionMethods,
  chatMethods,
  gameLifecycleMethods,
  goalMethods,
  celebrationMethods,
  statsMethods,
  teamMethods
);

module.exports = EventHandlers;
