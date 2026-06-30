const { isDbReady, ensureDbForRequest, getDbStatus } = require('../db/ensureDb');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fast DB gate for API middleware — never blocks more than maxMs.
 */
async function gateDatabase(maxMs = 8000) {
  if (isDbReady()) return { ok: true };

  try {
    const result = await Promise.race([
      ensureDbForRequest(3),
      sleep(maxMs).then(() => ({ ok: false, error: 'Database busy — retry' })),
    ]);
    if (result.ok && isDbReady()) return { ok: true };
    return {
      ok: false,
      error: result.error || 'Database not ready',
      status: getDbStatus(),
    };
  } catch (err) {
    return { ok: false, error: err.message, status: getDbStatus() };
  }
}

module.exports = { gateDatabase };
