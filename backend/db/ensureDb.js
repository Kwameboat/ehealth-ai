const fs = require('fs');
const path = require('path');
const { initDatabase, getDb, resetDatabase, DB_PATH } = require('./init');
const { findWasmPath } = require('./driver-sqljs');

let ready = false;
let initPromise = null;
let lastError = null;

function clearDbArtifacts() {
  const dirs = new Set([
    path.dirname(DB_PATH),
    path.join(__dirname, '..', 'db'),
    path.join(__dirname, '..', '..', 'data'),
  ]);
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      if (name.endsWith('.lock') || name.endsWith('.tmp')) {
        try {
          fs.unlinkSync(path.join(dir, name));
        } catch (_) {
          /* ignore */
        }
      }
    }
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureDbReady() {
  if (ready) {
    try {
      getDb();
      return;
    } catch (_) {
      ready = false;
      initPromise = null;
    }
  }
  if (initPromise) return initPromise;

  initPromise = (async () => {
    let lastErr;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        clearDbArtifacts();
        resetDatabase();
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
        console.error(`Database init attempt ${attempt}/3:`, err.message);
        if (attempt < 3) await sleep(150 * attempt);
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
  };
}

module.exports = { ensureDbReady, getDbStatus, clearDbArtifacts };
