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
    phone: row.phone || null,
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
      phone: user.phone || null,
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
    const { fullName, email, phone, password, currentPassword } = req.body || {};
    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
    if (!user) return res.status(404).json({ error: { message: 'User not found' } });

    const updates = [];
    const params = [];

    if (fullName !== undefined) {
      updates.push('full_name = ?');
      params.push((fullName || '').trim() || null);
    }

    if (email !== undefined) {
      const normalized = (email || '').trim().toLowerCase();
      if (!normalized || !normalized.includes('@')) {
        return res.status(400).json({ error: { message: 'Valid email is required' } });
      }
      const taken = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(normalized, req.userId);
      if (taken) return res.status(409).json({ error: { message: 'Email is already in use' } });
      updates.push('email = ?');
      params.push(normalized);
    }

    if (phone !== undefined) {
      const digits = String(phone || '').replace(/\D/g, '');
      if (digits && digits.length < 9) {
        return res.status(400).json({ error: { message: 'Enter a valid phone number with country code' } });
      }
      if (digits) {
        const taken = db.prepare('SELECT id FROM users WHERE phone = ? AND id != ?').get(digits, req.userId);
        if (taken) return res.status(409).json({ error: { message: 'Phone number is already linked' } });
      }
      updates.push('phone = ?');
      params.push(digits || null);
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

    if (!updates.length) return res.status(400).json({ error: { message: 'No changes provided' } });

    updates.push('updated_at = ?');
    params.push(now(), req.userId);
    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
    res.json({ user: sanitizeUser(updated) });
  } catch (e) {
    res.status(500).json({ error: { message: e.message } });
  }
});

router.get('/family-profiles', requireUserAuth, (req, res) => {
  const rows = getDb()
    .prepare(`SELECT * FROM family_profiles WHERE owner_user_id = ? AND is_active = 1 ORDER BY display_name`)
    .all(req.userId);
  res.json({
    profiles: rows.map((r) => ({
      id: r.id,
      displayName: r.display_name,
      relationship: r.relationship,
      phone: r.phone,
      conditions: r.conditions,
      notes: r.notes,
      createdAt: r.created_at,
    })),
  });
});

router.post('/family-profiles', requireUserAuth, (req, res) => {
  const { displayName, relationship, phone, conditions, notes } = req.body || {};
  if (!displayName || !String(displayName).trim()) {
    return res.status(400).json({ error: { message: 'displayName required' } });
  }
  const id = require('crypto').randomUUID();
  const ts = now();
  const digits = phone ? String(phone).replace(/\D/g, '') : null;
  getDb()
    .prepare(
      `INSERT INTO family_profiles (id, owner_user_id, display_name, relationship, phone, conditions, notes, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
    )
    .run(id, req.userId, String(displayName).trim(), relationship || null, digits, conditions || null, notes || null, ts, ts);
  res.status(201).json({
    profile: { id, displayName: String(displayName).trim(), relationship, phone: digits, conditions, notes },
  });
});

router.patch('/family-profiles/:id', requireUserAuth, (req, res) => {
  const row = getDb()
    .prepare(`SELECT * FROM family_profiles WHERE id = ? AND owner_user_id = ?`)
    .get(req.params.id, req.userId);
  if (!row) return res.status(404).json({ error: { message: 'Profile not found' } });

  const { displayName, relationship, phone, conditions, notes, isActive } = req.body || {};
  const fields = [];
  const params = [];
  if (displayName !== undefined) {
    fields.push('display_name = ?');
    params.push(String(displayName).trim());
  }
  if (relationship !== undefined) {
    fields.push('relationship = ?');
    params.push(relationship || null);
  }
  if (phone !== undefined) {
    fields.push('phone = ?');
    params.push(phone ? String(phone).replace(/\D/g, '') : null);
  }
  if (conditions !== undefined) {
    fields.push('conditions = ?');
    params.push(conditions || null);
  }
  if (notes !== undefined) {
    fields.push('notes = ?');
    params.push(notes || null);
  }
  if (isActive !== undefined) {
    fields.push('is_active = ?');
    params.push(isActive ? 1 : 0);
  }
  if (!fields.length) return res.status(400).json({ error: { message: 'No changes' } });
  fields.push('updated_at = ?');
  params.push(now(), req.params.id);
  getDb().prepare(`UPDATE family_profiles SET ${fields.join(', ')} WHERE id = ?`).run(...params);
  const updated = getDb().prepare(`SELECT * FROM family_profiles WHERE id = ?`).get(req.params.id);
  res.json({
    profile: {
      id: updated.id,
      displayName: updated.display_name,
      relationship: updated.relationship,
      phone: updated.phone,
      conditions: updated.conditions,
      notes: updated.notes,
      isActive: !!updated.is_active,
    },
  });
});

router.delete('/family-profiles/:id', requireUserAuth, (req, res) => {
  const row = getDb()
    .prepare(`SELECT id FROM family_profiles WHERE id = ? AND owner_user_id = ?`)
    .get(req.params.id, req.userId);
  if (!row) return res.status(404).json({ error: { message: 'Profile not found' } });
  getDb().prepare(`UPDATE family_profiles SET is_active = 0, updated_at = ? WHERE id = ?`).run(now(), req.params.id);
  res.json({ success: true });
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
