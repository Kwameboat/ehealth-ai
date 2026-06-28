const fs = require('fs');
const path = require('path');
const { initDatabase, getDb, resetDatabase, DB_PATH } = require('./init');
const { findWasmPath } = require('./driver-sqljs');
const { getDefaultDataPath } = require('./resolveDbPath');

let ready = false;
let initPromise = null;
let lastError = null;
let lastRecoveryAt = 0;

const STALE_MS = 60_000;
const MAX_INIT_ATTEMPTS = 6;

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
      if (!aggressive && !isStaleArtifact(full) && name.endsWith('.lock')) continue;
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
  return removed;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resetDbState() {
  ready = false;
  initPromise = null;
  resetDatabase();
}

async function recoverDatabase(reason) {
  const now = Date.now();
  if (now - lastRecoveryAt < 500) {
    await sleep(500);
  }
  lastRecoveryAt = Date.now();
  console.warn('[db] recovery:', reason || 'manual');
  resetDbState();
  clearDbArtifacts({ aggressive: true });
  await sleep(120);
}

async function ensureDbReady() {
  if (ready) {
    try {
      getDb().prepare('SELECT 1 AS ok').get();
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
        findWasmPath();
        await initDatabase();
        const { migrateLegacyGeminiModel } = require('../services/settings');
        migrateLegacyGeminiModel();
        getDb().prepare('SELECT 1 AS ok').get();
        ready = true;
        lastError = null;
        console.log(`Database ready: ${DB_PATH}`);
        return;
      } catch (err) {
        lastErr = err;
        ready = false;
        resetDatabase();
        console.error(`Database init attempt ${attempt}/${MAX_INIT_ATTEMPTS}:`, err.message);
        clearDbArtifacts({ aggressive: true });
        if (attempt < MAX_INIT_ATTEMPTS) {
          await sleep(Math.min(2000, 200 * attempt * attempt));
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

async function ensureDbReadyWithRecovery() {
  try {
    await ensureDbReady();
    return { ok: true };
  } catch (firstErr) {
    try {
      await recoverDatabase(firstErr.message);
      await ensureDbReady();
      return { ok: true, recovered: true };
    } catch (secondErr) {
      return { ok: false, error: secondErr.message || firstErr.message };
    }
  }
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
  const intervalMs = Number(process.env.DB_MAINTENANCE_MS) || 5 * 60 * 1000;
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
}

module.exports = {
  ensureDbReady,
  ensureDbReadyWithRecovery,
  recoverDatabase,
  getDbStatus,
  clearDbArtifacts,
  resetDbState,
  startDbMaintenance,
};
