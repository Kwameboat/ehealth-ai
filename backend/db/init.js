const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { openDatabase } = require('./driver-sqljs');
const { resolveDatabasePath } = require('./resolveDbPath');

const DB_PATH = resolveDatabasePath();

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

    CREATE TABLE IF NOT EXISTS whatsapp_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      phone TEXT NOT NULL,
      message_type TEXT NOT NULL,
      feature_key TEXT,
      points_charged INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL,
      payload_preview TEXT,
      response_preview TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_phone ON whatsapp_logs(phone);
    CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_created ON whatsapp_logs(created_at);
  `);

  migrateWhatsAppColumns(database);
  migrateWhatsAppFeatureTables(database);
}

function migrateWhatsAppFeatureTables(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS family_profiles (
      id TEXT PRIMARY KEY,
      owner_user_id TEXT NOT NULL,
      display_name TEXT NOT NULL,
      relationship TEXT,
      phone TEXT,
      conditions TEXT,
      notes TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (owner_user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS medication_reminders (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      profile_id TEXT,
      medication_name TEXT NOT NULL,
      dosage_text TEXT NOT NULL,
      schedule_times TEXT NOT NULL,
      duration_days INTEGER,
      ends_at TEXT,
      next_fire_at TEXT,
      last_sent_at TEXT,
      adherence_count INTEGER NOT NULL DEFAULT 0,
      snooze_count INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (profile_id) REFERENCES family_profiles(id)
    );

    CREATE TABLE IF NOT EXISTS reminder_events (
      id TEXT PRIMARY KEY,
      reminder_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (reminder_id) REFERENCES medication_reminders(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS wa_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      phone TEXT NOT NULL,
      session_type TEXT NOT NULL,
      payload TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS health_tracker_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      profile_id TEXT,
      tracker_type TEXT NOT NULL,
      value_text TEXT NOT NULL,
      value_numeric REAL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (profile_id) REFERENCES family_profiles(id)
    );

    CREATE TABLE IF NOT EXISTS wa_delivery_orders (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      medication_name TEXT NOT NULL,
      amount_kobo INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'GHS',
      paystack_reference TEXT,
      paystack_url TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      delivery_address TEXT,
      created_at TEXT NOT NULL,
      completed_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_family_owner ON family_profiles(owner_user_id);
    CREATE INDEX IF NOT EXISTS idx_reminders_user ON medication_reminders(user_id);
    CREATE INDEX IF NOT EXISTS idx_reminders_next ON medication_reminders(next_fire_at);
    CREATE INDEX IF NOT EXISTS idx_wa_sessions_phone ON wa_sessions(phone);
    CREATE INDEX IF NOT EXISTS idx_tracker_user ON health_tracker_logs(user_id);
  `);

  migrateDoctorsAndConsultations(database);
  migrateUserBroadcasts(database);
}

function migrateDoctorsAndConsultations(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS doctors (
      id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      specialty TEXT NOT NULL,
      bio TEXT,
      photo_url TEXT,
      license_number TEXT,
      hospital_affiliation TEXT,
      video_provider TEXT NOT NULL DEFAULT 'jitsi',
      video_room_slug TEXT,
      meet_url TEXT,
      consultation_fee_kobo INTEGER NOT NULL DEFAULT 5000,
      points_cost INTEGER NOT NULL DEFAULT 15,
      slot_duration_min INTEGER NOT NULL DEFAULT 30,
      is_active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS doctor_availability (
      id TEXT PRIMARY KEY,
      doctor_id TEXT NOT NULL,
      day_of_week INTEGER NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (doctor_id) REFERENCES doctors(id)
    );

    CREATE TABLE IF NOT EXISTS consultations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      doctor_id TEXT NOT NULL,
      scheduled_at TEXT NOT NULL,
      duration_min INTEGER NOT NULL DEFAULT 30,
      status TEXT NOT NULL DEFAULT 'pending',
      chief_complaint TEXT,
      video_url TEXT,
      meeting_id TEXT,
      points_charged INTEGER NOT NULL DEFAULT 0,
      amount_kobo INTEGER NOT NULL DEFAULT 0,
      paystack_reference TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (doctor_id) REFERENCES doctors(id)
    );

    CREATE INDEX IF NOT EXISTS idx_doctors_active ON doctors(is_active);
    CREATE INDEX IF NOT EXISTS idx_consultations_user ON consultations(user_id);
    CREATE INDEX IF NOT EXISTS idx_consultations_doctor ON consultations(doctor_id);
    CREATE INDEX IF NOT EXISTS idx_consultations_scheduled ON consultations(scheduled_at);
  `);
}

function migrateUserBroadcasts(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS health_broadcasts (
      id TEXT PRIMARY KEY,
      title TEXT,
      message TEXT NOT NULL,
      sent_by_admin_id TEXT,
      recipient_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS health_broadcast_reads (
      id TEXT PRIMARY KEY,
      broadcast_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      read_at TEXT NOT NULL,
      FOREIGN KEY (broadcast_id) REFERENCES health_broadcasts(id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      UNIQUE(broadcast_id, user_id)
    );

    CREATE INDEX IF NOT EXISTS idx_broadcast_reads_user ON health_broadcast_reads(user_id);
  `);
}

function migrateWhatsAppColumns(database) {
  try {
    database.exec(`ALTER TABLE users ADD COLUMN phone TEXT`);
  } catch {
    /* column exists */
  }
  try {
    database.exec(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone ON users(phone) WHERE phone IS NOT NULL AND phone != ''`
    );
  } catch {
    /* ignore */
  }
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
    ['lab_report', 'Lab results analysis', 10, 'Lab report photo or PDF interpretation'],
    ['wa_text', 'WhatsApp text chat', 1, 'WhatsApp standard text message via Agyenim'],
    ['wa_audio', 'WhatsApp voice note', 2, 'WhatsApp audio/voice note analysis'],
    ['wa_image', 'WhatsApp lab/medicine image', 5, 'WhatsApp image — lab or medicine packaging'],
    ['wa_facility', 'WhatsApp facility finder', 2, 'Find nearby pharmacy, lab, or clinic via location'],
    ['wa_nhis', 'WhatsApp NHIS assistant', 1, 'NHIS coverage guidance on WhatsApp'],
    ['wa_diet', 'WhatsApp diet coaching', 1, 'Ghanaian diet & chronic disease coaching'],
    ['pwa_nhis', 'NHIS assistant (app)', 1, 'NHIS coverage guidance in PWA'],
    ['pwa_diet', 'Ghana diet coach (app)', 1, 'Diet coaching in PWA'],
    ['pwa_bp_log', 'BP tracker log', 0, 'Log blood pressure reading'],
    ['pwa_facility', 'Facility finder (app)', 2, 'Find pharmacy, lab, clinic, hospital'],
    ['pwa_delivery', 'Medicine delivery (app)', 0, 'MoMo medicine delivery order'],
    ['video_consultation', 'Video consultation booking', 15, 'Book video call with doctor'],
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

function seedWhatsAppSettings() {
  const database = getDb();
  const upsert = database.prepare(`
    INSERT INTO system_settings (key, value, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(key) DO NOTHING
  `);
  const ts = now();
  const defaults = [
    ['whatsapp_evolution_base_url', process.env.EVOLUTION_API_URL || ''],
    ['whatsapp_evolution_api_key', process.env.EVOLUTION_API_KEY || ''],
    ['whatsapp_instance_name', process.env.EVOLUTION_INSTANCE_NAME || ''],
    ['whatsapp_webhook_secret', process.env.WHATSAPP_WEBHOOK_SECRET || ''],
    [
      'whatsapp_system_prompt',
      'You are Agyenim, the eHealth AI assistant on WhatsApp for Ghana. Give concise, caring health guidance in plain language. Use culturally relevant examples (Ghanaian foods, NHIS, local clinics). Not a doctor — advise seeing a clinician when needed. For NHIS questions, explain typical coverage patterns but remind users to confirm at their facility. For diet advice, reference local dishes (fufu, banku, kontomire, plantain, waakye) and practical substitutions.',
    ],
    [
      'pwa_system_prompt',
      'You are Agyenim, the eHealth AI smart health assistant inside the eHealth mobile/web app (PWA) for Ghana. The user is ALREADY in the app chatting with you. Answer directly in this conversation. NEVER tell them to use WhatsApp or visit the website to get answers. Give concise, caring health guidance with Ghana-relevant examples. Not a doctor — advise seeing a clinician when appropriate.',
    ],
    ['whatsapp_enabled', 'false'],
  ];
  for (const [key, value] of defaults) {
    upsert.run(key, value, ts);
  }
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

function seedSampleDoctors() {
  const database = getDb();
  const count = database.prepare('SELECT COUNT(*) AS c FROM doctors').get().c;
  if (count > 0) return;
  const ts = now();
  const doctorId = uuid();
  database
    .prepare(
      `INSERT INTO doctors (id, full_name, specialty, bio, hospital_affiliation, video_room_slug,
       consultation_fee_kobo, points_cost, slot_duration_min, is_active, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?, ?)`
    )
    .run(
      doctorId,
      'Dr. Yaw Mensah',
      'General Practice',
      'Telehealth consultations for general health, follow-ups, and chronic disease management.',
      'Korle Bu Teaching Hospital',
      'ehealth-consult',
      5000,
      15,
      30,
      ts,
      ts
    );
  const days = [1, 2, 3, 4, 5];
  for (const d of days) {
    database
      .prepare(
        `INSERT INTO doctor_availability (id, doctor_id, day_of_week, start_time, end_time, is_active)
         VALUES (?, ?, ?, '09:00', '17:00', 1)`
      )
      .run(uuid(), doctorId, d);
  }
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

let initInFlight = null;

function resetDatabase() {
  db = null;
  initInFlight = null;
}

async function initDatabase() {
  if (db) return;
  if (initInFlight) return initInFlight;

  initInFlight = (async () => {
    db = await openDatabase(DB_PATH);
    if (typeof db.setDeferPersist === 'function') db.setDeferPersist(true);
    initSchema();
    seedPointRules();
    seedPointPackages();
    seedSettings();
    seedWhatsAppSettings();
    seedAdmin();
    const { ensureAdminUser } = require('../services/adminUser');
    ensureAdminUser();
    syncEnvSecrets();
    const { migrateLegacyGeminiModel } = require('../services/settings');
    migrateLegacyGeminiModel();
    migratePackagesToGhs();
    seedSampleDoctors();
    if (typeof db.setDeferPersist === 'function') {
      db.setDeferPersist(false);
      db.flush();
    }
  })();

  try {
    await initInFlight;
  } finally {
    initInFlight = null;
  }
}

function flushDb() {
  try {
    const database = getDb();
    if (typeof database.flush === 'function') database.flush();
  } catch {
    /* ignore */
  }
}

module.exports = { getDb, initDatabase, resetDatabase, flushDb, uuid, now, DB_PATH };
