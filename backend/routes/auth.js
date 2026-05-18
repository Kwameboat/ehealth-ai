const express = require('express');
const bcrypt = require('bcryptjs');
const { getDb, uuid, now } = require('../db/init');
const { signUserToken } = require('../middleware/userAuth');
const { creditPoints } = require('../services/points');
const { getSignupBonus } = require('../services/settings');

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

router.post('/register', (req, res) => {
  try {
    const { email, password, fullName } = req.body || {};
    const normalizedEmail = (email || '').trim().toLowerCase();
    if (!normalizedEmail || !password || password.length < 6) {
      return res.status(400).json({ error: { message: 'Email and password (min 6 chars) required' } });
    }

    const existing = getDb().prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
    if (existing) {
      return res.status(409).json({ error: { message: 'Email already registered' } });
    }

    const id = uuid();
    const hash = bcrypt.hashSync(password, 10);
    const bonus = getSignupBonus();
    const ts = now();

    getDb()
      .prepare(
        `INSERT INTO users (id, email, password_hash, full_name, points_balance, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 1, ?, ?)`
      )
      .run(id, normalizedEmail, hash, fullName || null, bonus, ts, ts);

    if (bonus > 0) {
      creditPoints(id, bonus, 'signup_bonus', `Welcome bonus: ${bonus} points`);
    }

    const user = getDb().prepare('SELECT * FROM users WHERE id = ?').get(id);
    const token = signUserToken(user);
    res.status(201).json({ token, user: sanitizeUser(user) });
  } catch (e) {
    res.status(500).json({ error: { message: e.message } });
  }
});

router.post('/login', (req, res) => {
  try {
    const { email, password } = req.body || {};
    const normalizedEmail = (email || '').trim().toLowerCase();
    const user = getDb().prepare('SELECT * FROM users WHERE email = ?').get(normalizedEmail);

    if (!user || !bcrypt.compareSync(password || '', user.password_hash)) {
      return res.status(401).json({ error: { message: 'Invalid email or password' } });
    }
    if (!user.is_active) {
      return res.status(403).json({ error: { message: 'Account is disabled. Contact support.' } });
    }

    const token = signUserToken(user);
    res.json({ token, user: sanitizeUser(user) });
  } catch (e) {
    res.status(500).json({ error: { message: e.message } });
  }
});

module.exports = router;
