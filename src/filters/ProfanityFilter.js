const profanityWords = require('./profanityWords');

const EXCLUDE = new Set([
  'dolu', 'mal', 'oglan', 'babani', 'babanin', 'anneni', 'annenin',
  'gerizekali', 'kasar', 'donek', 'okuz',
  'sik', 'siki', 'sikici', 'sikil', 'sikilmis', 'sikilsin',
  'sikin', 'sikini', 'sikip', 'sikis', 'sikisme', 'sikismis',
  'sikiyorum', 'sikm',
  'got', 'bok', 'cuk', 'aq', 'oc', 'zk',
  'am', 'am biti', 'amk', 'amq', 'aq', 'aq.', 'amina', 'amini', 'aminakoyim', 'aminakoyarim',
  'mk', 'sg', 'sktr', 'sktir', 'aw', 'ak'
]);

const TR_WORD_BOUNDARY_START = '(?<![a-zA-ZığüşöçıİĞÜŞÖÇ])';
const TR_WORD_BOUNDARY_END = '(?![a-zA-ZığüşöçıİĞÜŞÖÇ])';

const TURKISH_SAFE_WORDS = new RegExp(`${TR_WORD_BOUNDARY_START}(sık(?:tı|t[ıi]r?|ıntı(?:lı)?|ıl(?:dı|mak|arak|an|ır|mış)?|ış(?:tır(?:dı|mak)?|ık|an|mak|mış)?|ıca|ıyı|ıydı|ıyor(?:um|sun|uz|lar)?|let(?:i|li)?|ı(?:n|m|lar)?|an|ar)|dik(?:tim|tin|ti|tik|tiniz|tiler|mek|en|ilmek|ili|ilmiş|iş)|çık(?:ar(?:dı|mak|ır|an|ıl|ıyor)?|tı|mak|ıyor|an|ış|mış|sın))${TR_WORD_BOUNDARY_END}`, 'gi');

const EXTRA_WORDS = [];
const STANDALONE_SHORT = new Set([]);

const CORE_PROFANITY_ROOTS = [
  'gotune', 'gotunu', 'gotun', 'gotu', 'gotunden',
  'orospu', 'orosbu', 'orozbu', 'orospo',
  'picc', 'pich',
  'yarak', 'yaraq',
  'siktir',
  'ibne', 'gavat'
];

const TR_MAP = {
  'ı': 'i', 'ş': 's', 'ğ': 'g', 'ç': 'c', 'ö': 'o', 'ü': 'u',
  'İ': 'i', 'Ş': 's', 'Ğ': 'g', 'Ç': 'c', 'Ö': 'o', 'Ü': 'u'
};

const LEET_MAP = {
  '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's',
  '7': 't', '@': 'a', '$': 's', '!': 'i', '€': 'e',
  '(': 'c', '|': 'i'
};

const LOOKALIKE_MAP = {
  'а': 'a', 'с': 'c', 'е': 'e', 'о': 'o', 'р': 'p', 'х': 'x',
  'у': 'y', 'к': 'k', 'м': 'm', 'н': 'n', 'т': 't', 'ь': 'b',
  'А': 'a', 'С': 'c', 'Е': 'e', 'О': 'o', 'Р': 'p', 'Х': 'x',
  'У': 'y', 'К': 'k', 'М': 'm', 'Н': 'n', 'Т': 't',
  'α': 'a', 'β': 'b', 'ε': 'e', 'η': 'n', 'ι': 'i', 'κ': 'k',
  'ο': 'o', 'ρ': 'p', 'τ': 't', 'υ': 'u', 'χ': 'x',
  'ᴀ': 'a', 'ʙ': 'b', 'ᴄ': 'c', 'ᴅ': 'd', 'ᴇ': 'e', 'ꜰ': 'f',
  'ɢ': 'g', 'ʜ': 'h', 'ɪ': 'i', 'ᴊ': 'j', 'ᴋ': 'k', 'ʟ': 'l',
  'ᴍ': 'm', 'ɴ': 'n', 'ᴏ': 'o', 'ᴘ': 'p', 'ǫ': 'q', 'ʀ': 'r',
  'ꜱ': 's', 'ᴛ': 't', 'ᴜ': 'u', 'ᴠ': 'v', 'ᴡ': 'w', 'ʏ': 'y',
  'ᴢ': 'z',
  '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4',
  '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9',
  '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4',
  '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9',
  'ₐ': 'a', 'ₑ': 'e', 'ₒ': 'o', 'ₓ': 'x',
  'Ａ': 'a', 'Ｂ': 'b', 'Ｃ': 'c', 'Ｄ': 'd', 'Ｅ': 'e', 'Ｆ': 'f',
  'Ｇ': 'g', 'Ｈ': 'h', 'Ｉ': 'i', 'Ｊ': 'j', 'Ｋ': 'k', 'Ｌ': 'l',
  'Ｍ': 'm', 'Ｎ': 'n', 'Ｏ': 'o', 'Ｐ': 'p', 'Ｑ': 'q', 'Ｒ': 'r',
  'Ｓ': 's', 'Ｔ': 't', 'Ｕ': 'u', 'Ｖ': 'v', 'Ｗ': 'w', 'Ｘ': 'x',
  'Ｙ': 'y', 'Ｚ': 'z',
  'ａ': 'a', 'ｂ': 'b', 'ｃ': 'c', 'ｄ': 'd', 'ｅ': 'e', 'ｆ': 'f',
  'ｇ': 'g', 'ｈ': 'h', 'ｉ': 'i', 'ｊ': 'j', 'ｋ': 'k', 'ｌ': 'l',
  'ｍ': 'm', 'ｎ': 'n', 'ｏ': 'o', 'ｐ': 'p', 'ｑ': 'q', 'ｒ': 'r',
  'ｓ': 's', 'ｔ': 't', 'ｕ': 'u', 'ｖ': 'v', 'ｗ': 'w', 'ｘ': 'x',
  'ｙ': 'y', 'ｚ': 'z',
  'ø': 'o', 'æ': 'a', 'ð': 'd', 'þ': 'p', 'ß': 'ss',
  'ñ': 'n', 'ý': 'y', 'ÿ': 'y', 'ã': 'a', 'å': 'a',
  'ë': 'e', 'ï': 'i', 'â': 'a', 'ê': 'e', 'î': 'i', 'ô': 'o', 'û': 'u',
  'à': 'a', 'è': 'e', 'ì': 'i', 'ò': 'o', 'ù': 'u',
  'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u'
};

const _allLookalikes = Object.keys(LOOKALIKE_MAP).join('').replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
const LOOKALIKE_REGEX = new RegExp(`[${_allLookalikes}]`, 'g');
const TR_REGEX = /[ışğçöüİŞĞÇÖÜ]/g;
const LEET_REGEX = /[013457@$!€(|]/g;
const ZERO_WIDTH_REGEX = /[\u200B-\u200F\u2028-\u202F\uFEFF\u00AD\u034F\u2060\u2061-\u2064\u206A-\u206F\uFFF0-\uFFF8\u180E\u115F\u1160\u3164]/g;
const SEPARATOR_REGEX = /(\w)[.\-_·•\/\\|,;:!?*+~`'"\u201C\u201D\u2018\u2019(){}\[\]<>]+(?=\w)/g;
const REPEAT_REGEX = /(.)\1+/g;
const COMBINING_REGEX = /[\u0300-\u036F\u1AB0-\u1AFF\u1DC0-\u1DFF\u20D0-\u20FF\uFE20-\uFE2F]/g;

const ENCLOSED_MAP = {};
for (let i = 0; i < 26; i++) {
  ENCLOSED_MAP[String.fromCodePoint(0x24B6 + i)] = String.fromCharCode(97 + i);
  ENCLOSED_MAP[String.fromCodePoint(0x24D0 + i)] = String.fromCharCode(97 + i);
}

function getTurkeyDate(ts) {
  return new Date(ts).toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul' });
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function collapseSpacedChars(text) {
  const parts = text.split(/\s+/);
  const result = [];
  let buffer = '';
  for (const part of parts) {
    if (part.length === 1 && /[a-z0-9]/.test(part)) {
      buffer += part;
    } else {
      if (buffer.length > 1) result.push(buffer);
      else if (buffer) result.push(buffer);
      buffer = '';
      result.push(part);
    }
  }
  if (buffer.length > 1) result.push(buffer);
  else if (buffer) result.push(buffer);
  return result.join(' ');
}

function normalizeText(text) {
  let t = text;
  t = t.replace(ZERO_WIDTH_REGEX, '');
  t = t.normalize('NFKD');
  t = t.replace(COMBINING_REGEX, '');
  t = t.replace(/./g, c => ENCLOSED_MAP[c] || c);
  t = t.replace(LOOKALIKE_REGEX, c => LOOKALIKE_MAP[c] || c);
  t = t.replace(TR_REGEX, c => TR_MAP[c] || c);
  t = t.replace(LEET_REGEX, c => LEET_MAP[c] || c);
  t = t.replace(SEPARATOR_REGEX, '$1');
  t = t.replace(REPEAT_REGEX, '$1');
  t = t.toLocaleLowerCase('tr');
  return t;
}

class ProfanityFilter {
  constructor(config = {}) {
    this.enabled = config.profanityFilterEnabled !== false;
    this.warnCooldownMs = config.profanityWarnCooldownMs || 3000;
    this._lastWarn = new Map();
    this._offenses = new Map();

    const words = [...profanityWords.filter(w => !EXCLUDE.has(w)), ...EXTRA_WORDS];
    const normalizedWords = [...new Set(
      words.map(w => normalizeText(w).replace(/[^a-z0-9 ]/g, '').trim())
    )].filter(w => w.length >= 4);

    const pattern = normalizedWords.map(escapeRegex).join('|');
    this._regex = pattern ? new RegExp(`\\b(?:${pattern})\\b`) : null;

    const coreNormalized = [...new Set(
      CORE_PROFANITY_ROOTS.map(w => normalizeText(w).replace(/[^a-z0-9]/g, '').trim())
    )].filter(w => w.length >= 4);
    const corePattern = coreNormalized.map(escapeRegex).join('|');
    this._coreRegex = corePattern ? new RegExp(corePattern) : null;
  }

  normalize(text) {
    return normalizeText(text);
  }

  check(text) {
    if (!this.enabled || !this._regex) return false;
    const safeText = text.replace(TURKISH_SAFE_WORDS, match => '_'.repeat(match.length));

    const tokens = safeText.split(/[\s_\-\.\/\\|,;:!?·•()\[\]{}<>]+/);
    for (const tok of tokens) {
      if (tok.length < 2) continue;
      const nt = normalizeText(tok).replace(/[^a-z0-9]/g, '');
      if (nt.length < 2) continue;
      if (STANDALONE_SHORT.has(nt)) return true;
      if (this._regex.test(nt)) return true;
      if (this._coreRegex && this._coreRegex.test(nt)) return true;
    }

    const normalized = normalizeText(safeText).replace(/[^a-z0-9 ]/g, '');
    const collapsed = collapseSpacedChars(normalized);
    if (collapsed !== normalized) {
      const collapsedTokens = collapsed.split(/\s+/);
      for (const ct of collapsedTokens) {
        if (STANDALONE_SHORT.has(ct)) return true;
      }
      if (this._regex.test(collapsed)) return true;
      if (this._coreRegex && this._coreRegex.test(collapsed)) return true;
    }
    return false;
  }

  recordOffense(auth) {
    if (!auth) return { action: 'warn', warningNumber: 1 };
    const now = Date.now();
    let record = this._offenses.get(auth);
    if (!record || getTurkeyDate(record.lastOffense) !== getTurkeyDate(now)) {
      record = { warnings: 0, lastOffense: now };
    }
    record.lastOffense = now;
    record.warnings++;
    this._offenses.set(auth, record);
    return { action: 'warn', warningNumber: record.warnings };
  }

  canWarn(playerId) {
    const now = Date.now();
    const last = this._lastWarn.get(playerId) || 0;
    if (now - last < this.warnCooldownMs) return false;
    this._lastWarn.set(playerId, now);
    return true;
  }

  resetOffenses(auth) {
    if (auth) this._offenses.delete(auth);
  }

  cleanup() {
    const now = Date.now();
    const today = getTurkeyDate(now);
    for (const [id, time] of this._lastWarn) {
      if (now - time > 60000) this._lastWarn.delete(id);
    }
    for (const [auth, record] of this._offenses) {
      if (getTurkeyDate(record.lastOffense) !== today) this._offenses.delete(auth);
    }
  }
}

module.exports = ProfanityFilter;
