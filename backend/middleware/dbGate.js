const { isDbReady, ensureDbReady, getDbStatus } = require('../db/ensureDb');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fast DB gate for API middleware — never blocks more than maxMs.
 */
async function gateDatabase(maxMs = 4000) {
  if (isDbReady()) return { ok: true };

  try {
    await Promise.race([
      ensureDbReady(),
      sleep(maxMs).then(() => {
        throw new Error('Database busy — retry');
      }),
    ]);
    if (isDbReady()) return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message, status: getDbStatus() };
  }

  return { ok: false, error: 'Database not ready', status: getDbStatus() };
}

module.exports = { gateDatabase };
