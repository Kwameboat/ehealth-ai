const { isDbReady, ensureDbForRequest, getDbStatus } = require('../db/ensureDb');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Ensures SQLite is ready for admin console routes (longer wait than global PWA gate). */
async function ensureAdminDatabase(req, res, next) {
  if (isDbReady()) return next();

  try {
    const result = await Promise.race([
      ensureDbForRequest(4),
      sleep(25_000).then(() => ({ ok: false, error: 'Database timeout — retry shortly' })),
    ]);

    if (!result.ok || !isDbReady()) {
      const diag = getDbStatus();
      return res.status(503).json({
        error: {
          message: 'Database not ready',
          detail: result.error || 'Could not open database',
          hint: 'Retry in a few seconds — auto-recovery is running',
          fix: 'bash ~/ehealth-ai/cpanel/fix-db-permanent.sh then RESTART Node.js',
          recoverUrl: '/api/health?recover=1',
          dbPath: diag.dbPath,
        },
      });
    }
    return next();
  } catch (err) {
    console.error('Admin DB middleware:', req.method, req.originalUrl, err.message);
    return res.status(503).json({
      error: {
        message: 'Database not ready',
        detail: err.message,
        recoverUrl: '/api/health?recover=1',
      },
    });
  }
}

module.exports = { ensureAdminDatabase };
