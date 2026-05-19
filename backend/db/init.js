const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { openDatabase } = require('./driver-sqljs');

const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, 'medassistant.db');

let db;

function uuid() {
  return crypto.randomUUID();
}

function now() {
  return new Date().toISOString();
}

function getDb() {
  if (!db) {
    throw new Error('Database not initialized — wait for startup or check server logs');
  }
  return db;
}

function initSchema() {
  const database = getDb();

  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT,
      points_balance INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS admins (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS point_rules (
      id TEXT PRIMARY KEY,
      feature_key TEXT UNIQUE NOT NULL,
      feature_name TEXT NOT NULL,
      points_cost INTEGER NOT NULL DEFAULT 1,
      description TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS point_transactions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      amount INTEGER NOT NULL,
      balance_after INTEGER NOT NULL,
      type TEXT NOT NULL,
      feature_key TEXT,
      note TEXT,
      admin_id TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS usage_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      feature_key TEXT NOT NULL,
      points_charged INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL,
      metadata TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_transactions_user ON point_transactions(user_id);
    CREATE INDEX IF NOT EXISTS idx_usage_user ON usage_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_usage_created ON usage_logs(created_at);

    CREATE TABLE IF NOT EXISTS point_packages (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      points INTEGER NOT NULL,
      amount_kobo INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'NGN',
      description TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      package_id TEXT,
      paystack_reference TEXT UNIQUE NOT NULL,
      amount_kobo INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'NGN',
      points_to_credit INTEGER NOT NULL,
      status TEXT NOT NULL,
      paystack_response TEXT,
      created_at TEXT NOT NULL,
      completed_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (package_id) REFERENCES point_packages(id)
    );

    CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id);
    CREATE INDEX IF NOT EXISTS idx_payments_ref ON payments(paystack_reference);
  `);
}

function seedPointRules() {
  const database = getDb();
  const defaults = [
    ['chat_text', 'Health Chat (text)', 2, 'Text-only health chat message'],
    ['chat_image', 'Health Chat (photo)', 8, 'Chat with image analysis'],
    ['chat_pdf', 'Health Chat (PDF)', 12, 'Chat with PDF document analysis'],
    ['symptom_text', 'Symptom analysis (text)', 3, 'Symptom screen text analysis'],
    ['symptom_image', 'Symptom analysis (photo)', 10, 'Symptom screen image analysis'],
    ['voice_consultation', 'Voice consultation', 5, 'Medical voice assistant turn'],
    ['emergency_lookup', 'Emergency lookup', 4, 'Emergency hospital lookup'],
    ['medicine_scan', 'Medicine recognition', 6, 'Medicine image scan (when enabled)'],
  ];

  const insert = database.prepare(`
    INSERT OR IGNORE INTO point_rules (id, feature_key, feature_name, points_cost, description, is_active, updated_at)
    VALUES (?, ?, ?, ?, ?, 1, ?)
  `);

  const ts = now();
  for (const [key, name, cost, desc] of defaults) {
    insert.run(uuid(), key, name, cost, desc, ts);
  }
}

function seedSettings() {
  const database = getDb();
  const upsert = database.prepare(`
    INSERT INTO system_settings (key, value, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(key) DO NOTHING
  `);
  const ts = now();
  upsert.run('points_enabled', 'true', ts);
  upsert.run('signup_bonus_points', '100', ts);
  upsert.run('app_name', 'eHealth AI', ts);
  upsert.run('app_tagline', 'AI Health Assistance — Not a Doctor', ts);
  upsert.run('payment_currency', 'GHS', ts);
}

function syncEnvSecrets() {
  const { syncEnvToDatabase } = require('../services/settings');
  syncEnvToDatabase();
}

function seedPointPackages() {
  const database = getDb();
  const count = database.prepare('SELECT COUNT(*) AS c FROM point_packages').get().c;
  if (count > 0) return;

  const packages = [
    ['Starter', 100, 2000, 'GHS', '100 points — GHC 20', 1],
    ['Standard', 350, 6000, 'GHS', '350 points — GHC 60', 2],
    ['Pro', 900, 15000, 'GHS', '900 points — GHC 150', 3],
  ];

  const insert = database.prepare(`
    INSERT INTO point_packages (id, name, points, amount_kobo, currency, description, is_active, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
  `);
  const ts = now();
  for (const [name, points, kobo, currency, desc, order] of packages) {
    insert.run(uuid(), name, points, kobo, currency, desc, order, ts, ts);
  }
}

function seedAdmin() {
  const database = getDb();
  const count = database.prepare('SELECT COUNT(*) AS c FROM admins').get().c;
  if (count > 0) return;

  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'admin123';
  const hash = bcrypt.hashSync(password, 10);

  database.prepare(`
    INSERT INTO admins (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)
  `).run(uuid(), username, hash, now());

  console.log(`Admin seeded: username="${username}" (change ADMIN_PASSWORD in production)`);
}

function migratePackagesToGhs() {
  const database = getDb();
  const row = database.prepare('SELECT id, currency, amount_kobo FROM point_packages WHERE points = 100 ORDER BY sort_order LIMIT 1').get();
  if (row && row.currency === 'NGN' && row.amount_kobo >= 50000) {
    database
      .prepare(
        `UPDATE point_packages SET amount_kobo = 2000, currency = 'GHS', description = '100 points — GHC 20', updated_at = ? WHERE id = ?`
      )
      .run(now(), row.id);
  }
}

async function initDatabase() {
  db = await openDatabase(DB_PATH);
  initSchema();
  seedPointRules();
  seedPointPackages();
  seedSettings();
  seedAdmin();
  syncEnvSecrets();
  migratePackagesToGhs();
}

module.exports = { getDb, initDatabase, uuid, now, DB_PATH };
