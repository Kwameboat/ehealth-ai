const express = require('express');
const bcrypt = require('bcryptjs');
const { getDb, uuid, now } = require('../db/init');
const { signAdminToken, requireAdminAuth } = require('../middleware/adminAuth');
const { creditPoints, adminAdjustPoints, getAllRules, updateRule } = require('../services/points');
const {
  getAllSettings,
  setSetting,
  getSetting,
  getGeminiApiKey,
  getGeminiModel,
  getPaystackSecretKey,
  getPaystackPublicKey,
  getPaymentCurrency,
} = require('../services/settings');
const {
  listAllPackages,
  createPackage,
  updatePackage,
  deletePackage,
  formatPackage,
} = require('../services/packages');
const { getDashboardData, getFreshCache, getStaleCache } = require('../services/dashboardCache');
const { isDbReady } = require('../db/ensureDb');
const { adminRouter: whatsappAdminRouter } = require('./whatsapp-bridge');

const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    const name = (username || '').trim();
    if (!name || !password) {
      return res.status(400).json({ error: { message: 'Username and password required' } });
    }
    const admin = getDb().prepare('SELECT * FROM admins WHERE username = ?').get(name);
    if (!admin?.password_hash) {
      return res.status(401).json({ error: { message: 'Invalid credentials' } });
    }
    if (!bcrypt.compareSync(password, admin.password_hash)) {
      return res.status(401).json({ error: { message: 'Invalid credentials' } });
    }
    const token = signAdminToken(admin);
    res.json({ token, admin: { id: admin.id, username: admin.username } });
  } catch (err) {
    console.error('Admin login error:', err);
    res.status(500).json({
      error: {
        message: 'Login failed on server',
        detail: process.env.NODE_ENV === 'production' ? undefined : err.message,
      },
    });
  }
});

router.get('/session', requireAdminAuth, (req, res) => {
  res.json({ ok: true, admin: { id: req.adminId, username: req.adminUsername } });
});

router.use(requireAdminAuth);

router.use('/whatsapp', whatsappAdminRouter);

router.get('/dashboard', (req, res) => {
  try {
    const fresh = getFreshCache();
    if (fresh) return res.json(fresh);
    if (!isDbReady()) return res.json(getStaleCache());
    const db = getDb();
    res.json(getDashboardData(db));
  } catch (err) {
    console.error('Dashboard error:', err.message);
    const stale = getStaleCache();
    if (stale) return res.json(stale);
    res.status(503).json({
      error: {
        message: 'Dashboard temporarily unavailable',
        detail: err.message,
        hint: 'Retry in a few seconds',
      },
    });
  }
});

router.get('/users', (req, res) => {
  const search = (req.query.search || '').trim().toLowerCase();
  let rows;
  if (search) {
    rows = getDb()
      .prepare(
        `SELECT id, email, full_name, points_balance, is_active, created_at, updated_at
         FROM users WHERE lower(email) LIKE ? OR lower(full_name) LIKE ?
         ORDER BY created_at DESC LIMIT 100`
      )
      .all(`%${search}%`, `%${search}%`);
  } else {
    rows = getDb()
      .prepare(
        `SELECT id, email, full_name, points_balance, is_active, created_at, updated_at
         FROM users ORDER BY created_at DESC LIMIT 200`
      )
      .all();
  }
  res.json({
    users: rows.map((u) => ({
      id: u.id,
      email: u.email,
      fullName: u.full_name,
      pointsBalance: u.points_balance,
      isActive: !!u.is_active,
      createdAt: u.created_at,
      updatedAt: u.updated_at,
    })),
  });
});

router.get('/users/:id', (req, res) => {
  const user = getDb().prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: { message: 'User not found' } });
  const transactions = getDb()
    .prepare(
      `SELECT * FROM point_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`
    )
    .all(req.params.id);
  const usage = getDb()
    .prepare(`SELECT * FROM usage_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 30`)
    .all(req.params.id);
  res.json({
    user: {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      pointsBalance: user.points_balance,
      isActive: !!user.is_active,
      createdAt: user.created_at,
    },
    transactions,
    usage,
  });
});

router.patch('/users/:id', (req, res) => {
  const { isActive, fullName, phone } = req.body || {};
  const user = getDb().prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: { message: 'User not found' } });

  if (isActive !== undefined) {
    getDb().prepare('UPDATE users SET is_active = ?, updated_at = ? WHERE id = ?').run(isActive ? 1 : 0, now(), req.params.id);
  }
  if (fullName !== undefined) {
    getDb().prepare('UPDATE users SET full_name = ?, updated_at = ? WHERE id = ?').run(fullName, now(), req.params.id);
  }
  if (phone !== undefined) {
    const digits = String(phone || '').replace(/\D/g, '') || null;
    if (digits) {
      const taken = getDb().prepare('SELECT id FROM users WHERE phone = ? AND id != ?').get(digits, req.params.id);
      if (taken) return res.status(409).json({ error: { message: 'Phone already linked to another user' } });
    }
    getDb().prepare('UPDATE users SET phone = ?, updated_at = ? WHERE id = ?').run(digits, now(), req.params.id);
  }
  const updated = getDb().prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  res.json({
    user: {
      id: updated.id,
      email: updated.email,
      fullName: updated.full_name,
      pointsBalance: updated.points_balance,
      isActive: !!updated.is_active,
    },
  });
});

router.post('/users/:id/points', (req, res) => {
  try {
    const { amount, note } = req.body || {};
    const delta = parseInt(amount, 10);
    if (!delta || Number.isNaN(delta)) {
      return res.status(400).json({ error: { message: 'amount required (positive or negative integer)' } });
    }
    const result = adminAdjustPoints(req.params.id, delta, note, req.adminId);
    res.json({
      balance: result.balance,
      message: delta > 0 ? `Added ${delta} points` : `Deducted ${Math.abs(delta)} points`,
    });
  } catch (e) {
    res.status(e.status || 500).json({ error: { message: e.message } });
  }
});

router.get('/point-rules', (req, res) => {
  const rules = getAllRules().map((r) => ({
    id: r.id,
    featureKey: r.feature_key,
    featureName: r.feature_name,
    pointsCost: r.points_cost,
    description: r.description,
    isActive: !!r.is_active,
    updatedAt: r.updated_at,
  }));
  res.json({ rules });
});

router.put('/point-rules/:id', (req, res) => {
  const { featureName, pointsCost, description, isActive } = req.body || {};
  const updates = {};
  if (featureName !== undefined) updates.feature_name = featureName;
  if (pointsCost !== undefined) updates.points_cost = parseInt(pointsCost, 10);
  if (description !== undefined) updates.description = description;
  if (isActive !== undefined) updates.is_active = isActive;
  const rule = updateRule(req.params.id, updates);
  if (!rule) return res.status(404).json({ error: { message: 'Rule not found' } });
  res.json({
    rule: {
      id: rule.id,
      featureKey: rule.feature_key,
      featureName: rule.feature_name,
      pointsCost: rule.points_cost,
      description: rule.description,
      isActive: !!rule.is_active,
    },
  });
});

router.get('/transactions', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
  const rows = getDb()
    .prepare(
      `SELECT t.*, u.email FROM point_transactions t
       LEFT JOIN users u ON u.id = t.user_id
       ORDER BY t.created_at DESC LIMIT ?`
    )
    .all(limit);
  res.json({ transactions: rows });
});

router.get('/usage', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
  const rows = getDb()
    .prepare(
      `SELECT l.*, u.email FROM usage_logs l
       LEFT JOIN users u ON u.id = l.user_id
       ORDER BY l.created_at DESC LIMIT ?`
    )
    .all(limit);
  res.json({ usage: rows });
});

router.get('/settings', (req, res) => {
  res.json({ settings: getAllSettings() });
});

router.put('/settings', (req, res) => {
  const { settings } = req.body || {};
  if (!settings || typeof settings !== 'object') {
    return res.status(400).json({ error: { message: 'settings object required' } });
  }
  const allowed = ['points_enabled', 'signup_bonus_points', 'app_name', 'payment_currency'];
  for (const key of allowed) {
    if (settings[key] !== undefined) setSetting(key, settings[key]);
  }
  res.json({ settings: getAllSettings() });
});

function isMaskedSecret(value) {
  return !value || String(value).includes('••••');
}

router.get('/integrations', (req, res) => {
  const { isConfigured: paystackOk } = require('../services/paystack');
  res.json({
    geminiConfigured: !!getGeminiApiKey(),
    paystackConfigured: paystackOk(),
    paystackPublicConfigured: !!getPaystackPublicKey(),
    geminiModel: getGeminiModel(),
    paymentCurrency: getPaymentCurrency(),
    geminiKeyPreview: getGeminiApiKey() ? `${getGeminiApiKey().slice(0, 6)}••••` : '',
    paystackSecretPreview: getPaystackSecretKey() ? `${getPaystackSecretKey().slice(0, 7)}••••` : '',
    paystackPublicPreview: getPaystackPublicKey() ? `${getPaystackPublicKey().slice(0, 7)}••••` : '',
  });
});

router.put('/integrations', (req, res) => {
  const {
    geminiApiKey,
    paystackSecretKey,
    paystackPublicKey,
    geminiModel,
    paymentCurrency,
  } = req.body || {};

  if (geminiApiKey !== undefined && !isMaskedSecret(geminiApiKey)) {
    setSetting('gemini_api_key', geminiApiKey.trim());
  }
  if (paystackSecretKey !== undefined && !isMaskedSecret(paystackSecretKey)) {
    setSetting('paystack_secret_key', paystackSecretKey.trim());
  }
  if (paystackPublicKey !== undefined && !isMaskedSecret(paystackPublicKey)) {
    setSetting('paystack_public_key', paystackPublicKey.trim());
  }
  if (geminiModel !== undefined) setSetting('gemini_model', geminiModel.trim());
  if (paymentCurrency !== undefined) setSetting('payment_currency', paymentCurrency.trim());

  const { isConfigured: paystackOk } = require('../services/paystack');
  res.json({
    success: true,
    geminiConfigured: !!getGeminiApiKey(),
    paystackConfigured: paystackOk(),
  });
});

router.get('/system-status', (req, res) => {
  const { isConfigured: paystackOk } = require('../services/paystack');
  res.json({
    geminiConfigured: !!getGeminiApiKey(),
    appSecretConfigured: !!process.env.APP_API_SECRET,
    jwtConfigured: !!process.env.JWT_SECRET,
    paystackConfigured: paystackOk(),
    pointsEnabled: getSetting('points_enabled', 'true') === 'true',
    model: getGeminiModel(),
    paymentCurrency: getPaymentCurrency(),
  });
});

router.get('/point-packages', (req, res) => {
  res.json({ packages: listAllPackages().map(formatPackage) });
});

router.post('/point-packages', (req, res) => {
  try {
    const { name, points, priceMajor, currency, description, sortOrder, isActive } = req.body || {};
    if (!name || !points || priceMajor === undefined) {
      return res.status(400).json({ error: { message: 'name, points, and priceMajor required' } });
    }
    const pkg = createPackage({
      name,
      points,
      priceMajor,
      currency: currency || getPaymentCurrency(),
      description,
      sortOrder,
      isActive,
    });
    res.status(201).json({ package: formatPackage(pkg) });
  } catch (e) {
    res.status(400).json({ error: { message: e.message } });
  }
});

router.put('/point-packages/:id', (req, res) => {
  try {
    const { name, points, priceMajor, currency, description, sortOrder, isActive } = req.body || {};
    const pkg = updatePackage(req.params.id, {
      name,
      points,
      priceMajor,
      currency,
      description,
      sortOrder,
      isActive,
    });
    if (!pkg) return res.status(404).json({ error: { message: 'Package not found' } });
    res.json({ package: formatPackage(pkg) });
  } catch (e) {
    res.status(400).json({ error: { message: e.message } });
  }
});

router.delete('/point-packages/:id', (req, res) => {
  const ok = deletePackage(req.params.id);
  if (!ok) return res.status(404).json({ error: { message: 'Package not found' } });
  res.json({ success: true });
});

router.get('/payments', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
  const rows = getDb()
    .prepare(
      `SELECT p.*, u.email FROM payments p
       LEFT JOIN users u ON u.id = p.user_id
       ORDER BY p.created_at DESC LIMIT ?`
    )
    .all(limit);
  res.json({ payments: rows });
});

function mapDoctorRow(r) {
  return {
    id: r.id,
    fullName: r.full_name,
    specialty: r.specialty,
    bio: r.bio,
    photoUrl: r.photo_url,
    licenseNumber: r.license_number,
    hospitalAffiliation: r.hospital_affiliation,
    videoProvider: r.video_provider,
    videoRoomSlug: r.video_room_slug,
    meetUrl: r.meet_url,
    consultationFeeKobo: r.consultation_fee_kobo,
    pointsCost: r.points_cost,
    slotDurationMin: r.slot_duration_min,
    isActive: !!r.is_active,
    sortOrder: r.sort_order,
    createdAt: r.created_at,
  };
}

router.get('/doctors', (req, res) => {
  const rows = getDb()
    .prepare(`SELECT * FROM doctors ORDER BY sort_order, full_name`)
    .all();
  res.json({ doctors: rows.map(mapDoctorRow) });
});

router.post('/doctors', (req, res) => {
  try {
    const b = req.body || {};
    if (!b.fullName || !b.specialty) {
      return res.status(400).json({ error: { message: 'fullName and specialty required' } });
    }
    const id = uuid();
    const ts = now();
    getDb()
      .prepare(
        `INSERT INTO doctors (id, full_name, specialty, bio, photo_url, license_number, hospital_affiliation,
         video_provider, video_room_slug, meet_url, consultation_fee_kobo, points_cost, slot_duration_min,
         is_active, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        String(b.fullName).trim(),
        String(b.specialty).trim(),
        b.bio || null,
        b.photoUrl || null,
        b.licenseNumber || null,
        b.hospitalAffiliation || null,
        b.videoProvider || 'jitsi',
        b.videoRoomSlug || null,
        b.meetUrl || null,
        Number(b.consultationFeeKobo) || 5000,
        Number(b.pointsCost) || 15,
        Number(b.slotDurationMin) || 30,
        b.isActive !== false ? 1 : 0,
        Number(b.sortOrder) || 0,
        ts,
        ts
      );
    const row = getDb().prepare(`SELECT * FROM doctors WHERE id = ?`).get(id);
    res.status(201).json({ doctor: mapDoctorRow(row) });
  } catch (e) {
    res.status(400).json({ error: { message: e.message } });
  }
});

router.patch('/doctors/:id', (req, res) => {
  const row = getDb().prepare(`SELECT * FROM doctors WHERE id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: { message: 'Doctor not found' } });
  const b = req.body || {};
  const fields = [];
  const params = [];
  const map = {
    fullName: 'full_name',
    specialty: 'specialty',
    bio: 'bio',
    photoUrl: 'photo_url',
    licenseNumber: 'license_number',
    hospitalAffiliation: 'hospital_affiliation',
    videoProvider: 'video_provider',
    videoRoomSlug: 'video_room_slug',
    meetUrl: 'meet_url',
    consultationFeeKobo: 'consultation_fee_kobo',
    pointsCost: 'points_cost',
    slotDurationMin: 'slot_duration_min',
    sortOrder: 'sort_order',
  };
  for (const [k, col] of Object.entries(map)) {
    if (b[k] !== undefined) {
      fields.push(`${col} = ?`);
      params.push(b[k]);
    }
  }
  if (b.isActive !== undefined) {
    fields.push('is_active = ?');
    params.push(b.isActive ? 1 : 0);
  }
  if (!fields.length) return res.status(400).json({ error: { message: 'No changes' } });
  fields.push('updated_at = ?');
  params.push(now(), req.params.id);
  getDb().prepare(`UPDATE doctors SET ${fields.join(', ')} WHERE id = ?`).run(...params);
  const updated = getDb().prepare(`SELECT * FROM doctors WHERE id = ?`).get(req.params.id);
  res.json({ doctor: mapDoctorRow(updated) });
});

router.delete('/doctors/:id', (req, res) => {
  const row = getDb().prepare(`SELECT id FROM doctors WHERE id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: { message: 'Doctor not found' } });
  getDb().prepare(`UPDATE doctors SET is_active = 0, updated_at = ? WHERE id = ?`).run(now(), req.params.id);
  res.json({ success: true });
});

router.get('/doctors/:id/availability', (req, res) => {
  const rows = getDb()
    .prepare(`SELECT * FROM doctor_availability WHERE doctor_id = ? ORDER BY day_of_week, start_time`)
    .all(req.params.id);
  res.json({
    availability: rows.map((a) => ({
      id: a.id,
      dayOfWeek: a.day_of_week,
      startTime: a.start_time,
      endTime: a.end_time,
      isActive: !!a.is_active,
    })),
  });
});

router.post('/doctors/:id/availability', (req, res) => {
  const { dayOfWeek, startTime, endTime } = req.body || {};
  if (dayOfWeek === undefined || !startTime || !endTime) {
    return res.status(400).json({ error: { message: 'dayOfWeek, startTime, endTime required' } });
  }
  const doctor = getDb().prepare(`SELECT id FROM doctors WHERE id = ?`).get(req.params.id);
  if (!doctor) return res.status(404).json({ error: { message: 'Doctor not found' } });
  const id = uuid();
  getDb()
    .prepare(
      `INSERT INTO doctor_availability (id, doctor_id, day_of_week, start_time, end_time, is_active)
       VALUES (?, ?, ?, ?, ?, 1)`
    )
    .run(id, req.params.id, Number(dayOfWeek), startTime, endTime);
  res.status(201).json({ id, dayOfWeek: Number(dayOfWeek), startTime, endTime });
});

router.delete('/doctors/:doctorId/availability/:slotId', (req, res) => {
  getDb()
    .prepare(`UPDATE doctor_availability SET is_active = 0 WHERE id = ? AND doctor_id = ?`)
    .run(req.params.slotId, req.params.doctorId);
  res.json({ success: true });
});

router.get('/consultations', (req, res) => {
  const rows = getDb()
    .prepare(
      `SELECT c.*, u.email, u.full_name AS patient_name, d.full_name AS doctor_name, d.specialty
       FROM consultations c
       JOIN users u ON u.id = c.user_id
       JOIN doctors d ON d.id = c.doctor_id
       ORDER BY c.scheduled_at DESC LIMIT 100`
    )
    .all();
  res.json({ consultations: rows });
});

router.post('/broadcasts', (req, res) => {
  const { title, message } = req.body || {};
  if (!message || !String(message).trim()) {
    return res.status(400).json({ error: { message: 'message required' } });
  }
  const id = uuid();
  const ts = now();
  getDb()
    .prepare(`INSERT INTO health_broadcasts (id, title, message, recipient_count, created_at) VALUES (?, ?, ?, 0, ?)`)
    .run(id, title || 'Health alert', String(message).trim(), ts);
  res.status(201).json({ success: true, id });
});

router.get('/broadcasts', (req, res) => {
  const rows = getDb()
    .prepare(
      `SELECT id, title, message, recipient_count, created_at FROM health_broadcasts ORDER BY created_at DESC LIMIT 100`
    )
    .all();
  res.json({ broadcasts: rows });
});

router.get('/delivery-orders', (req, res) => {
  const rows = getDb()
    .prepare(
      `SELECT o.*, u.email, u.full_name AS patient_name
       FROM wa_delivery_orders o
       LEFT JOIN users u ON u.id = o.user_id
       ORDER BY o.created_at DESC LIMIT 100`
    )
    .all();
  res.json({ orders: rows });
});

router.patch('/consultations/:id', (req, res) => {
  const { status } = req.body || {};
  const allowed = ['pending', 'scheduled', 'completed', 'cancelled', 'no_show'];
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: { message: 'Invalid status' } });
  }
  const row = getDb().prepare(`SELECT id FROM consultations WHERE id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: { message: 'Not found' } });
  getDb()
    .prepare(`UPDATE consultations SET status = ?, updated_at = ? WHERE id = ?`)
    .run(status, now(), req.params.id);
  res.json({ success: true, status });
});

module.exports = router;
