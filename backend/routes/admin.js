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

const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    const admin = getDb()
      .prepare('SELECT * FROM admins WHERE username = ?')
      .get((username || '').trim());
    if (!admin?.password_hash) {
      return res.status(401).json({ error: { message: 'Invalid credentials' } });
    }
    if (!bcrypt.compareSync(password || '', admin.password_hash)) {
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

router.use(requireAdminAuth);

router.get('/dashboard', (req, res) => {
  const db = getDb();
  const stats = {
    users: db.prepare('SELECT COUNT(*) AS c FROM users').get().c,
    activeUsers: db.prepare('SELECT COUNT(*) AS c FROM users WHERE is_active = 1').get().c,
    totalPoints: db.prepare('SELECT COALESCE(SUM(points_balance), 0) AS s FROM users').get().s,
    transactionsToday: db
      .prepare(`SELECT COUNT(*) AS c FROM point_transactions WHERE date(created_at) = date('now')`)
      .get().c,
    usageToday: db.prepare(`SELECT COUNT(*) AS c FROM usage_logs WHERE date(created_at) = date('now')`).get().c,
    pointsDebitedToday: db
      .prepare(
        `SELECT COALESCE(SUM(ABS(amount)), 0) AS s FROM point_transactions
         WHERE amount < 0 AND date(created_at) = date('now')`
      )
      .get().s,
  };

  const recentUsage = db
    .prepare(
      `SELECT u.email, l.feature_key, l.points_charged, l.status, l.created_at
       FROM usage_logs l LEFT JOIN users u ON u.id = l.user_id
       ORDER BY l.created_at DESC LIMIT 15`
    )
    .all();

  const topFeatures = db
    .prepare(
      `SELECT feature_key, COUNT(*) AS count, SUM(points_charged) AS total_points
       FROM usage_logs WHERE status = 'success' GROUP BY feature_key ORDER BY count DESC LIMIT 8`
    )
    .all();

  res.json({ stats, recentUsage, topFeatures });
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
  const { isActive, fullName } = req.body || {};
  const user = getDb().prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: { message: 'User not found' } });

  if (isActive !== undefined) {
    getDb().prepare('UPDATE users SET is_active = ?, updated_at = ? WHERE id = ?').run(isActive ? 1 : 0, now(), req.params.id);
  }
  if (fullName !== undefined) {
    getDb().prepare('UPDATE users SET full_name = ?, updated_at = ? WHERE id = ?').run(fullName, now(), req.params.id);
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

module.exports = router;
