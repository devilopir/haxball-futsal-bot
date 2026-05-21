const path = require('path');
const fs = require('fs');

const BOT_ID = process.env.BOT_ID || 'bot1';

const BOTS_JSON_PATH = path.join(__dirname, 'bots.json');
let botsConfig = {};
try {
  botsConfig = JSON.parse(fs.readFileSync(BOTS_JSON_PATH, 'utf8'));
} catch (e) {
  console.error('[Config] bots.json okunamadı:', e.message);
}

const botConf = botsConfig[BOT_ID] || {};

const TOKEN_DIR = path.join(__dirname, 'data', 'tokens');
const TOKEN_PATH = path.join(TOKEN_DIR, `${BOT_ID}.token`);

function readToken() {
  try {
    if (fs.existsSync(TOKEN_PATH)) {
      return fs.readFileSync(TOKEN_PATH, 'utf8').trim() || null;
    }
  } catch (e) {}
  return null;
}

const BOT_NUMBER = BOT_ID.replace(/\D/g, '') || '1';

const ROOM_TYPES = {
  agir_acemi_1: { name: 'Ağır Acemi 1', minPoints: 0, maxPoints: 500 },
  agir_acemi_2: { name: 'Ağır Acemi 2', minPoints: 0, maxPoints: 500 },
  orta: { name: 'Orta 3', minPoints: 1000, maxPoints: Infinity },
  orta_2: { name: 'Orta 4', minPoints: 1000, maxPoints: Infinity },
  hp: { name: 'HP 5', minPoints: 2000, maxPoints: Infinity },
  hp_2: { name: 'HP 6', minPoints: 2000, maxPoints: Infinity }
};

const ROOM_TYPE = botConf.roomType || 'agir_acemi_1';
const ROOM_TYPE_NAME = ROOM_TYPES[ROOM_TYPE]?.name || 'Futsal';
const ROOM_NAME = process.env.ROOM_NAME || `Futsal ${ROOM_TYPE_NAME}`;
const DATA_GROUP = botConf.dataGroup || 'default';
const PROXY = botConf.proxy || null;

console.log(`[Config] Bot: ${BOT_ID}, Oda: ${ROOM_TYPE_NAME}`);

const ROOM_TYPE_GEO = {
  agir_acemi_1: { code: 'tr', lat: 40.100, lon: 29.030 },
  agir_acemi_2: { code: 'tr', lat: 40.101, lon: 29.030 },
  orta: { code: 'tr', lat: 40.103, lon: 29.030 },
  orta_2: { code: 'tr', lat: 40.104, lon: 29.030 },
  hp: { code: 'tr', lat: 40.105, lon: 29.030 },
  hp_2: { code: 'tr', lat: 40.106, lon: 29.030 }
};

module.exports = {
  botId: BOT_ID,
  botNumber: BOT_NUMBER,
  dataGroup: DATA_GROUP,
  tokenPath: TOKEN_PATH,
  tokenDir: TOKEN_DIR,
  token: readToken(),
  twoCaptchaApiKey: '',
  autoRefreshToken: true,
  databaseUrl: process.env.DATABASE_URL || 'postgresql://haxball:password@localhost:5432/haxball',
  roomType: ROOM_TYPE,
  roomTypes: ROOM_TYPES,
  roomConfig: {
    roomName: ROOM_NAME,
    password: null,
    maxPlayers: 12,
    public: true,
    noPlayer: true,
    geo: ROOM_TYPE_GEO[ROOM_TYPE] || { code: 'tr', lat: 40.100, lon: 29.030 },
    ...(PROXY && { proxy: PROXY })
  },
  captainTimeout: 15,
  afkKickEnabled: true,
  afkKickTimeout: 10,
  afkWarningTime: 5,

  rateLimit: {
    windowMs: 10000,
    maxRequests: 5,
    maxWarnings: 3
  },

  joinLimit: {
    windowMs: 30000,
    maxJoins: 3
  },

  ownerNickname: '',

  nickRules: {
    maxLength: 50
  },

  moderation: {
    profanityFilterEnabled: true,
    profanityWarnCooldownMs: 3000
  },
};
