const fs = require('fs');
const path = require('path');
const { initDatabase, getDb, DB_PATH } = require('./init');
const { findWasmPath } = require('./driver-sqljs');

let ready = false;
let initPromise = null;
let lastError = null;

function clearDbArtifacts() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) return;
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

async function ensureDbReady() {
  if (ready) {
    getDb();
    return;
  }
  if (initPromise) return initPromise;

  initPromise = (async () => {
    clearDbArtifacts();
    const wasm = findWasmPath();
    await initDatabase();
    getDb().prepare('SELECT 1 AS ok').get();
    ready = true;
    lastError = null;
    console.log(`Database ready: ${DB_PATH} (wasm: ${wasm})`);
  })().catch((err) => {
    ready = false;
    lastError = err;
    initPromise = null;
    console.error('Database init failed:', err.message);
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
    lastError: lastError ? lastError.message : null,
  };
}

module.exports = { ensureDbReady, getDbStatus, clearDbArtifacts };
