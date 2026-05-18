const { getDb, uuid, now } = require('../db/init');
const { isPointsEnabled } = require('./settings');

class PointsError extends Error {
  constructor(message, code = 'INSUFFICIENT_POINTS', status = 402) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function getRule(featureKey) {
  return getDb()
    .prepare('SELECT * FROM point_rules WHERE feature_key = ? AND is_active = 1')
    .get(featureKey);
}

function getAllRules() {
  return getDb().prepare('SELECT * FROM point_rules ORDER BY feature_name').all();
}

function getUserBalance(userId) {
  const user = getDb().prepare('SELECT points_balance, is_active FROM users WHERE id = ?').get(userId);
  if (!user) throw new PointsError('User not found', 'USER_NOT_FOUND', 404);
  if (!user.is_active) throw new PointsError('Account is disabled', 'ACCOUNT_DISABLED', 403);
  return user.points_balance;
}

function logUsage(userId, featureKey, pointsCharged, status, metadata = null) {
  getDb()
    .prepare(
      `INSERT INTO usage_logs (id, user_id, feature_key, points_charged, status, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(uuid(), userId, featureKey, pointsCharged, status, metadata ? JSON.stringify(metadata) : null, now());
}

function deductPoints(userId, featureKey, note = null) {
  if (!isPointsEnabled()) {
    return { charged: 0, balance: getUserBalance(userId), skipped: true };
  }

  const rule = getRule(featureKey);
  if (!rule) {
    throw new PointsError(`Unknown feature: ${featureKey}`, 'INVALID_FEATURE', 400);
  }

  const cost = rule.points_cost;
  const database = getDb();

  const deduct = database.transaction(() => {
    const user = database.prepare('SELECT points_balance, is_active FROM users WHERE id = ?').get(userId);
    if (!user) throw new PointsError('User not found', 'USER_NOT_FOUND', 404);
    if (!user.is_active) throw new PointsError('Account is disabled', 'ACCOUNT_DISABLED', 403);
    if (user.points_balance < cost) {
      throw new PointsError(
        `Insufficient points. Need ${cost}, you have ${user.points_balance}.`,
        'INSUFFICIENT_POINTS',
        402
      );
    }

    const newBalance = user.points_balance - cost;
    database.prepare('UPDATE users SET points_balance = ?, updated_at = ? WHERE id = ?').run(newBalance, now(), userId);

    database
      .prepare(
        `INSERT INTO point_transactions (id, user_id, amount, balance_after, type, feature_key, note, created_at)
         VALUES (?, ?, ?, ?, 'debit', ?, ?, ?)`
      )
      .run(uuid(), userId, -cost, newBalance, featureKey, note, now());

    return { charged: cost, balance: newBalance, rule };
  });

  const result = deduct();
  logUsage(userId, featureKey, result.charged, 'success');
  return result;
}

function creditPoints(userId, amount, type, note, adminId = null) {
  if (amount <= 0) throw new Error('Credit amount must be positive');

  const database = getDb();
  const credit = database.transaction(() => {
    const user = database.prepare('SELECT points_balance FROM users WHERE id = ?').get(userId);
    if (!user) throw new PointsError('User not found', 'USER_NOT_FOUND', 404);

    const newBalance = user.points_balance + amount;
    database.prepare('UPDATE users SET points_balance = ?, updated_at = ? WHERE id = ?').run(newBalance, now(), userId);

    database
      .prepare(
        `INSERT INTO point_transactions (id, user_id, amount, balance_after, type, feature_key, note, admin_id, created_at)
         VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?)`
      )
      .run(uuid(), userId, amount, newBalance, type, note, adminId, now());

    return { balance: newBalance };
  });

  return credit();
}

function adminAdjustPoints(userId, delta, note, adminId) {
  if (delta === 0) throw new Error('Amount cannot be zero');
  if (delta > 0) return creditPoints(userId, delta, 'admin_adjustment', note, adminId);

  const abs = Math.abs(delta);
  const database = getDb();
  return database.transaction(() => {
    const user = database.prepare('SELECT points_balance FROM users WHERE id = ?').get(userId);
    if (!user) throw new PointsError('User not found', 'USER_NOT_FOUND', 404);
    if (user.points_balance < abs) {
      throw new PointsError('Cannot deduct more than user balance', 'INSUFFICIENT_BALANCE', 400);
    }
    const newBalance = user.points_balance - abs;
    database.prepare('UPDATE users SET points_balance = ?, updated_at = ? WHERE id = ?').run(newBalance, now(), userId);
    database
      .prepare(
        `INSERT INTO point_transactions (id, user_id, amount, balance_after, type, feature_key, note, admin_id, created_at)
         VALUES (?, ?, ?, ?, 'admin_adjustment', NULL, ?, ?, ?)`
      )
      .run(uuid(), userId, -abs, newBalance, note || 'Admin deduction', adminId, now());
    return { balance: newBalance };
  })();
}

function updateRule(id, updates) {
  const allowed = ['feature_name', 'points_cost', 'description', 'is_active'];
  const fields = [];
  const values = [];
  for (const key of allowed) {
    if (updates[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(key === 'is_active' ? (updates[key] ? 1 : 0) : updates[key]);
    }
  }
  if (fields.length === 0) return getDb().prepare('SELECT * FROM point_rules WHERE id = ?').get(id);
  fields.push('updated_at = ?');
  values.push(now(), id);
  getDb().prepare(`UPDATE point_rules SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return getDb().prepare('SELECT * FROM point_rules WHERE id = ?').get(id);
}

module.exports = {
  PointsError,
  getRule,
  getAllRules,
  getUserBalance,
  deductPoints,
  creditPoints,
  adminAdjustPoints,
  updateRule,
  logUsage,
};
