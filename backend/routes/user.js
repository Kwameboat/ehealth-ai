const express = require('express');
const { getDb } = require('../db/init');
const { requireUserAuth } = require('../middleware/userAuth');
const { getAllRules } = require('../services/points');
const { isPointsEnabled } = require('../services/settings');

const router = express.Router();

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
