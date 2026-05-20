const express = require('express');
const bcrypt = require('bcryptjs');
const { getDb, now } = require('../db/init');
const { requireUserAuth } = require('../middleware/userAuth');
const { getAllRules } = require('../services/points');
const { isPointsEnabled } = require('../services/settings');

const router = express.Router();

function sanitizeUser(row) {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    pointsBalance: row.points_balance,
    isActive: !!row.is_active,
    createdAt: row.created_at,
  };
}

router.get('/me', requireUserAuth, (req, res) => {
  const user = getDb().prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
  if (!user) return res.status(404).json({ error: { message: 'User not found' } });
  res.json({
    user: {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      pointsBalance: user.points_balance,
      isActive: !!user.is_active,
    },
    pointsEnabled: isPointsEnabled(),
  });
});

router.get('/points/rules', requireUserAuth, (req, res) => {
  const rules = getAllRules()
    .filter((r) => r.is_active)
    .map((r) => ({
      featureKey: r.feature_key,
      featureName: r.feature_name,
      pointsCost: r.points_cost,
      description: r.description,
    }));
  res.json({ rules, pointsEnabled: isPointsEnabled() });
});

router.patch('/me', requireUserAuth, (req, res) => {
  try {
    const { fullName, email, password, currentPassword } = req.body || {};
    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
    if (!user) return res.status(404).json({ error: { message: 'User not found' } });

    const updates = [];
    const params = [];

    if (fullName !== undefined) {
      const trimmed = (fullName || '').trim();
      updates.push('full_name = ?');
      params.push(trimmed || null);
    }

    if (email !== undefined) {
      const normalized = (email || '').trim().toLowerCase();
      if (!normalized || !normalized.includes('@')) {
        return res.status(400).json({ error: { message: 'Valid email is required' } });
      }
      const taken = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(normalized, req.userId);
      if (taken) {
        return res.status(409).json({ error: { message: 'Email is already in use' } });
      }
      updates.push('email = ?');
      params.push(normalized);
    }

    if (password) {
      if (!currentPassword || !bcrypt.compareSync(currentPassword, user.password_hash)) {
        return res.status(401).json({ error: { message: 'Current password is incorrect' } });
      }
      if (password.length < 6) {
        return res.status(400).json({ error: { message: 'New password must be at least 6 characters' } });
      }
      updates.push('password_hash = ?');
      params.push(bcrypt.hashSync(password, 10));
    }

    if (!updates.length) {
      return res.status(400).json({ error: { message: 'No changes provided' } });
    }

    updates.push('updated_at = ?');
    params.push(now());
    params.push(req.userId);

    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
    res.json({ user: sanitizeUser(updated) });
  } catch (e) {
    res.status(500).json({ error: { message: e.message } });
  }
});

router.delete('/me', requireUserAuth, (req, res) => {
  try {
    const { password } = req.body || {};
    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
    if (!user) return res.status(404).json({ error: { message: 'User not found' } });

    if (!password || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: { message: 'Password is required to delete your account' } });
    }

    const id = req.userId;
    db.prepare('DELETE FROM point_transactions WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM usage_logs WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM payments WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM users WHERE id = ?').run(id);

    res.json({ ok: true, message: 'Account deleted' });
  } catch (e) {
    res.status(500).json({ error: { message: e.message } });
  }
});

router.get('/points/transactions', requireUserAuth, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
  const rows = getDb()
    .prepare(
      `SELECT id, amount, balance_after, type, feature_key, note, created_at
       FROM point_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`
    )
    .all(req.userId, limit);
  res.json({
    transactions: rows.map((t) => ({
      id: t.id,
      amount: t.amount,
      balanceAfter: t.balance_after,
      type: t.type,
      featureKey: t.feature_key,
      note: t.note,
      createdAt: t.created_at,
    })),
  });
});

module.exports = router;
