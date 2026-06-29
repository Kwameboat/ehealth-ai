const fs = require('fs');
const path = require('path');
const { initDatabase, getDb, resetDatabase, DB_PATH } = require('./init');
const { findWasmPath, quarantineCorruptDb } = require('./driver-sqljs');
const { getDefaultDataPath } = require('./resolveDbPath');
const { releaseLock } = require('./fileLock');

let ready = false;
let initPromise = null;
let lastError = null;
let lastRecoveryAt = 0;
let watchdogStarted = false;

const STALE_MS = 12_000;
const MAX_INIT_ATTEMPTS = 10;
const RECOVERY_COOLDOWN_MS = 250;

function dbArtifactDirs() {
  const dirs = new Set([
    path.dirname(DB_PATH),
    path.join(__dirname, '..', 'db'),
    path.join(__dirname, '..', '..', 'data'),
    path.dirname(getDefaultDataPath()),
  ]);
  if (process.env.HOME) {
    dirs.add(path.join(process.env.HOME, 'ehealth-ai', 'data'));
    dirs.add(path.join(process.env.HOME, 'ehealth-ai', 'backend', 'db'));
  }
  return [...dirs].filter(Boolean);
}

function isDbArtifact(name) {
  if (!name || name === 'medassistant.db') return false;
  if (name.endsWith('.lock') || name.endsWith('.tmp')) return true;
  if (name.startsWith('.writetest-')) return true;
  if (name.startsWith('medassistant.db.')) return true;
  if (/\.db-(journal|wal|shm)$/i.test(name)) return true;
  return false;
}

function isStaleArtifact(filePath) {
  try {
    const stat = fs.statSync(filePath);
    return Date.now() - stat.mtimeMs > STALE_MS;
  } catch {
    return true;
  }
}

function clearDbArtifacts({ aggressive = false } = {}) {
  let removed = 0;
  for (const dir of dbArtifactDirs()) {
    if (!fs.existsSync(dir)) continue;
    let names;
    try {
      names = fs.readdirSync(dir);
    } catch {
      continue;
    }
    for (const name of names) {
      if (!isDbArtifact(name)) continue;
      const full = path.join(dir, name);
      if (name.endsWith('.lock') && !aggressive && !isStaleArtifact(full)) continue;
      try {
        fs.unlinkSync(full);
        removed += 1;
      } catch {
        /* ignore */
      }
    }
    const dbTmp = path.join(dir, `${path.basename(DB_PATH)}.tmp`);
    if (fs.existsSync(dbTmp)) {
      try {
        fs.unlinkSync(dbTmp);
        removed += 1;
      } catch {
        /* ignore */
      }
    }
  }
  try {
    releaseLock(`${DB_PATH}.lock`);
  } catch {
    /* ignore */
  }
  return removed;
}

function backupCorruptDatabase(reason) {
  if (!fs.existsSync(DB_PATH)) return false;
  if (!ready) {
    try {
      const stat = fs.statSync(DB_PATH);
      if (stat.size < 512) {
        quarantineCorruptDb(DB_PATH, reason || 'file too small');
        return true;
      }
    } catch {
      /* ignore */
    }
    return false;
  }
  try {
    getDb().prepare('SELECT 1').get();
    return false;
  } catch {
    quarantineCorruptDb(DB_PATH, reason || 'probe failed');
    resetDbState();
    return true;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resetDbState() {
  ready = false;
  initPromise = null;
  resetDatabase();
}

function probeDatabase() {
  getDb().prepare('SELECT 1 AS ok').get();
}

async function recoverDatabase(reason) {
  const now = Date.now();
  if (now - lastRecoveryAt < RECOVERY_COOLDOWN_MS) {
    await sleep(RECOVERY_COOLDOWN_MS);
  }
  lastRecoveryAt = Date.now();
  console.warn('[db] recovery:', reason || 'manual');
  resetDbState();
  clearDbArtifacts({ aggressive: true });
  await sleep(150);
}

async function ensureDbReady() {
  if (ready) {
    try {
      probeDatabase();
      return;
    } catch (_) {
      resetDbState();
    }
  }
  if (initPromise) return initPromise;

  initPromise = (async () => {
    let lastErr;
    for (let attempt = 1; attempt <= MAX_INIT_ATTEMPTS; attempt += 1) {
      try {
        clearDbArtifacts({ aggressive: attempt > 1 });
        backupCorruptDatabase(`init attempt ${attempt}`);
        findWasmPath();
        await initDatabase();
        probeDatabase();
        ready = true;
        lastError = null;
        console.log(`Database ready: ${DB_PATH}`);
        return;
      } catch (err) {
        lastErr = err;
        ready = false;
        resetDatabase();
        lastError = err;
        console.error(`Database init attempt ${attempt}/${MAX_INIT_ATTEMPTS}:`, err.message);
        clearDbArtifacts({ aggressive: true });
        if (attempt < MAX_INIT_ATTEMPTS) {
          await sleep(Math.min(3000, 250 * attempt * attempt));
        }
      }
    }
    throw lastErr;
  })().catch((err) => {
    ready = false;
    lastError = err;
    initPromise = null;
    throw err;
  });

  return initPromise;
}

/**
 * Init + one recovery cycle (legacy API).
 */
async function ensureDbReadyWithRecovery(recoveryAttempts = 3) {
  for (let cycle = 0; cycle < recoveryAttempts; cycle += 1) {
    try {
      await ensureDbReady();
      return { ok: true, recovered: cycle > 0 };
    } catch (err) {
      if (cycle >= recoveryAttempts - 1) {
        return { ok: false, error: err.message };
      }
      await recoverDatabase(err.message);
      await sleep(300 * (cycle + 1));
    }
  }
  return { ok: false, error: lastError?.message || 'Database not ready' };
}

/** Used by API middleware — never give up on first failure. */
async function ensureDbForRequest(maxAttempts = 5) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const result = await ensureDbReadyWithRecovery(3);
    if (result.ok) return result;
    clearDbArtifacts({ aggressive: true });
    await sleep(400 * (attempt + 1));
  }
  return { ok: false, error: lastError?.message || 'Database not ready after retries' };
}

/** Block Passenger startup until DB is usable (prevents first-request 503). */
async function startupDatabase(maxWaitMs = 30_000) {
  const started = Date.now();
  let lastErr = 'timeout';
  while (Date.now() - started < maxWaitMs) {
    clearDbArtifacts({ aggressive: true });
    backupCorruptDatabase('startup');
    const result = await ensureDbReadyWithRecovery(3);
    if (result.ok) {
      console.log('[db] startupDatabase: OK', result.recovered ? '(recovered)' : '');
      return result;
    }
    lastErr = result.error || lastErr;
    await sleep(500);
  }
  throw new Error(lastErr || 'Database startup timeout');
}

function getDbStatus() {
  return {
    ready,
    dbPath: DB_PATH,
    wasmPath: (() => {
      try {
        return findWasmPath();
      } catch (e) {
        return e.message;
      }
    })(),
    dbExists: fs.existsSync(DB_PATH),
    dbWritable: (() => {
      try {
        const dir = path.dirname(DB_PATH);
        fs.accessSync(dir, fs.constants.W_OK);
        return true;
      } catch {
        return false;
      }
    })(),
    lastError: lastError ? lastError.message : null,
    pid: process.pid,
  };
}

function startDbMaintenance() {
  if (watchdogStarted) return;
  watchdogStarted = true;

  const intervalMs = Number(process.env.DB_MAINTENANCE_MS) || 3 * 60 * 1000;
  setInterval(() => {
    try {
      clearDbArtifacts();
      if (ready) {
        const db = getDb();
        if (typeof db.flush === 'function') db.flush();
      }
    } catch (err) {
      console.warn('[db] maintenance:', err.message);
    }
  }, intervalMs).unref();

  const probeMs = Number(process.env.DB_PROBE_MS) || 25_000;
  setInterval(async () => {
    try {
      if (!ready) {
        await ensureDbReadyWithRecovery(2);
        return;
      }
      probeDatabase();
    } catch (err) {
      console.warn('[db] watchdog: probe failed — recovering:', err.message);
      try {
        await recoverDatabase('watchdog');
        await ensureDbReadyWithRecovery(3);
      } catch (e) {
        console.error('[db] watchdog recovery failed:', e.message);
      }
    }
  }, probeMs).unref();
}

module.exports = {
  ensureDbReady,
  ensureDbReadyWithRecovery,
  ensureDbForRequest,
  startupDatabase,
  recoverDatabase,
  getDbStatus,
  clearDbArtifacts,
  resetDbState,
  backupCorruptDatabase,
  startDbMaintenance,
};
