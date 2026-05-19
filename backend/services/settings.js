const { getDb, now } = require('../db/init');
const { DEFAULT_GEMINI_MODEL, normalizeGeminiModel } = require('./geminiModels');

const SECRET_KEYS = ['gemini_api_key', 'paystack_secret_key', 'paystack_public_key'];

function getSetting(key, fallback = null) {
  const row = getDb().prepare('SELECT value FROM system_settings WHERE key = ?').get(key);
  if (row?.value) return row.value;
  return fallback;
}

function setSetting(key, value) {
  getDb()
    .prepare(
      `INSERT INTO system_settings (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    )
    .run(key, String(value), now());
}

function getAllSettings(includeSecrets = false) {
  const rows = getDb().prepare('SELECT key, value, updated_at FROM system_settings ORDER BY key').all();
  const out = {};
  for (const r of rows) {
    if (SECRET_KEYS.includes(r.key) && !includeSecrets) {
      out[r.key] = {
        value: r.value ? maskSecret(r.value) : '',
        configured: !!r.value,
        updatedAt: r.updated_at,
      };
    } else {
      out[r.key] = { value: r.value, updatedAt: r.updated_at };
    }
  }
  return out;
}

function maskSecret(value) {
  if (!value || value.length < 8) return '••••••••';
  return `${value.slice(0, 4)}••••${value.slice(-4)}`;
}

function getGeminiApiKey() {
  return getSetting('gemini_api_key') || process.env.GEMINI_API_KEY || null;
}

function getGeminiModel() {
  const raw = getSetting('gemini_model') || process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
  return normalizeGeminiModel(raw);
}

function getPaystackSecretKey() {
  return getSetting('paystack_secret_key') || process.env.PAYSTACK_SECRET_KEY || null;
}

function getPaystackPublicKey() {
  return getSetting('paystack_public_key') || process.env.PAYSTACK_PUBLIC_KEY || null;
}

function getPaymentCurrency() {
  return getSetting('payment_currency', 'GHS') || 'GHS';
}

function isPointsEnabled() {
  return getSetting('points_enabled', 'true') === 'true';
}

function getSignupBonus() {
  return parseInt(getSetting('signup_bonus_points', '100'), 10) || 0;
}

function migrateLegacyGeminiModel() {
  const row = getDb().prepare('SELECT value FROM system_settings WHERE key = ?').get('gemini_model');
  if (!row?.value) return;
  const current = row.value.trim().replace(/^models\//, '');
  const next = normalizeGeminiModel(current);
  if (next !== current) {
    setSetting('gemini_model', next);
    console.log(`Upgraded gemini_model: ${current} -> ${next}`);
  }
}

function syncEnvToDatabase() {
  const pairs = [
    ['gemini_api_key', process.env.GEMINI_API_KEY],
    ['paystack_secret_key', process.env.PAYSTACK_SECRET_KEY],
    ['paystack_public_key', process.env.PAYSTACK_PUBLIC_KEY],
    ['gemini_model', process.env.GEMINI_MODEL],
  ];
  for (const [key, val] of pairs) {
    if (val && !getSetting(key)) setSetting(key, val);
  }
  if (!getSetting('payment_currency')) setSetting('payment_currency', 'GHS');
}

module.exports = {
  getSetting,
  setSetting,
  getAllSettings,
  getGeminiApiKey,
  getGeminiModel,
  getPaystackSecretKey,
  getPaystackPublicKey,
  getPaymentCurrency,
  isPointsEnabled,
  getSignupBonus,
  syncEnvToDatabase,
  migrateLegacyGeminiModel,
  SECRET_KEYS,
};
