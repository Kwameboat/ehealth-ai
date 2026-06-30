const { isDbReady, ensureDbForRequest, getDbStatus } = require('../db/ensureDb');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Wait for SQLite before route handlers call getDb(). */
async function ensureRouteDatabase(req, res, next, timeoutMs = 20_000) {
  if (isDbReady()) return next();

  try {
    const result = await Promise.race([
      ensureDbForRequest(4),
      sleep(timeoutMs).then(() => ({ ok: false, error: 'Database timeout — retry shortly' })),
    ]);

    if (!result.ok || !isDbReady()) {
      const diag = getDbStatus();
      return res.status(503).json({
        error: {
          message: 'Database not ready',
          detail: result.error || 'Could not open database',
          hint: 'Retry in a few seconds — auto-recovery is running',
          recoverUrl: '/api/health?recover=1',
          dbPath: diag.dbPath,
        },
      });
    }
    return next();
  } catch (err) {
    console.error('Route DB middleware:', req.method, req.originalUrl, err.message);
    return res.status(503).json({
      error: {
        message: 'Database not ready',
        detail: err.message,
        recoverUrl: '/api/health?recover=1',
      },
    });
  }
}

module.exports = { ensureRouteDatabase };
