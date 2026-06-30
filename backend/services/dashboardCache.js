let cache = null;
let cachedAt = 0;
const TTL_MS = Number(process.env.DASHBOARD_CACHE_MS) || 90_000;

function emptyDashboard() {
  return {
    stats: {
      users: 0,
      activeUsers: 0,
      totalPoints: 0,
      transactionsToday: 0,
      usageToday: 0,
      pointsDebitedToday: 0,
    },
    recentUsage: [],
    topFeatures: [],
    cached: true,
    stale: true,
    fallback: true,
  };
}

function buildFromDb(db) {
  const stats = {
    users: db.prepare('SELECT COUNT(*) AS c FROM users').get().c,
    activeUsers: db.prepare('SELECT COUNT(*) AS c FROM users WHERE is_active = 1').get().c,
    totalPoints: db.prepare('SELECT COALESCE(SUM(points_balance), 0) AS s FROM users').get().s,
    transactionsToday: db
      .prepare(`SELECT COUNT(*) AS c FROM point_transactions WHERE date(created_at) = date('now')`)
      .get().c,
    usageToday: db.prepare(`SELECT COUNT(*) AS c FROM usage_logs WHERE date(created_at) = date('now')`).get()
      .c,
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

  return { stats, recentUsage, topFeatures };
}

function getDashboardData(db) {
  const payload = buildFromDb(db);
  cache = payload;
  cachedAt = Date.now();
  return { ...payload, cached: false };
}

function getFreshCache() {
  if (!cache || Date.now() - cachedAt > TTL_MS) return null;
  return { ...cache, cached: true };
}

function getStaleCache() {
  if (!cache) return emptyDashboard();
  return { ...cache, cached: true, stale: true };
}

function clearDashboardCache() {
  cache = null;
  cachedAt = 0;
}

module.exports = { getDashboardData, getFreshCache, getStaleCache, clearDashboardCache, emptyDashboard };
