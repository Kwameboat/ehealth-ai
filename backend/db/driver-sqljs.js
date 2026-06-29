const fs = require('fs');
const path = require('path');
const { withFileLock } = require('./fileLock');

let sqlModulePromise = null;

function findWasmPath() {
  if (process.env.SQLJS_WASM_PATH && fs.existsSync(process.env.SQLJS_WASM_PATH)) {
    return process.env.SQLJS_WASM_PATH;
  }
  const candidates = [
    path.join(__dirname, 'sql-wasm.wasm'),
    path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'),
    path.join(__dirname, '..', '..', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'),
  ];
  try {
    const pkg = require.resolve('sql.js/package.json');
    candidates.push(path.join(path.dirname(pkg), 'dist', 'sql-wasm.wasm'));
  } catch (_) {
    /* sql.js not on module path */
  }
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error(
    'sql-wasm.wasm missing. Upload backend/db/sql-wasm.wasm or run: cp node_modules/sql.js/dist/sql-wasm.wasm backend/db/'
  );
}

async function loadSqlModule() {
  if (!sqlModulePromise) {
    const wasmPath = findWasmPath();
    const initSqlJs = require('sql.js');
    const timeoutMs = Number(process.env.SQLJS_INIT_TIMEOUT_MS) || 20_000;
    sqlModulePromise = Promise.race([
      initSqlJs({ locateFile: () => wasmPath }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('sql.js WASM init timeout')), timeoutMs)
      ),
    ]);
  }
  return sqlModulePromise;
}

function removeIfExists(filePath) {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    /* ignore */
  }
}

function quarantineCorruptDb(dbPath, reason) {
  if (!fs.existsSync(dbPath)) return null;
  const bak = `${dbPath}.corrupt-${Date.now()}.bak`;
  try {
    fs.renameSync(dbPath, bak);
    console.error(`[db] Quarantined corrupt DB -> ${bak} (${reason})`);
    return bak;
  } catch (err) {
    console.error('[db] Could not quarantine corrupt DB:', err.message);
    return null;
  }
}

function writeBytesUnsafe(filePath, buf) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = `${filePath}.tmp`;
  removeIfExists(tmp);
  fs.writeFileSync(tmp, buf);
  try {
    fs.renameSync(tmp, filePath);
  } catch (_) {
    fs.writeFileSync(filePath, buf);
    removeIfExists(tmp);
  }
}

function writeFileSafe(filePath, buf) {
  const lockPath = `${filePath}.lock`;
  return withFileLock(
    lockPath,
    () => {
      writeBytesUnsafe(filePath, buf);
    },
    { timeoutMs: 30_000 }
  );
}

function createWrapper(SQL, dbPath) {
  let rawDb;
  let deferPersist = false;
  let dirty = false;
  let txnDepth = 0;
  let persistTimer = null;
  let opChain = Promise.resolve();
  const lockPath = `${dbPath}.lock`;
  const persistDelayMs =
    Number(process.env.DB_PERSIST_DELAY_MS) ||
    (process.env.NODE_ENV === 'production' ? 1500 : 350);

  function runSerialized(fn) {
    const run = opChain.then(fn, fn);
    opChain = run.catch(() => {});
    return run;
  }

  function loadFromDiskSync() {
    removeIfExists(`${dbPath}.tmp`);
    if (!fs.existsSync(dbPath)) {
      rawDb = new SQL.Database();
      return;
    }
    try {
      const buf = fs.readFileSync(dbPath);
      rawDb = new SQL.Database(buf);
      const rows = rawDb.exec('PRAGMA integrity_check');
      const status = rows?.[0]?.values?.[0]?.[0];
      if (status && status !== 'ok') {
        throw new Error(`integrity_check: ${status}`);
      }
    } catch (err) {
      quarantineCorruptDb(dbPath, err.message);
      rawDb = new SQL.Database();
    }
  }

  function persistNowSync() {
    if (deferPersist || txnDepth > 0) {
      dirty = true;
      return;
    }
    writeBytesUnsafe(dbPath, Buffer.from(rawDb.export()));
    dirty = false;
  }

  function persistNow() {
    return runSerialized(() =>
      withFileLock(
        lockPath,
        () => {
          persistNowSync();
        },
        { timeoutMs: 30_000 }
      )
    );
  }

  function persist() {
    if (deferPersist || txnDepth > 0) {
      dirty = true;
      return;
    }
    if (persistTimer) return;
    persistTimer = setTimeout(() => {
      persistTimer = null;
      persistNow().catch((err) => {
        console.error('[db] persist failed:', err.message);
        dirty = true;
      });
    }, persistDelayMs);
    if (typeof persistTimer.unref === 'function') persistTimer.unref();
  }

  function flush() {
    if (persistTimer) {
      clearTimeout(persistTimer);
      persistTimer = null;
    }
    return runSerialized(() =>
      withFileLock(
        lockPath,
        () => {
          if (dirty || deferPersist || txnDepth > 0) {
            writeBytesUnsafe(dbPath, Buffer.from(rawDb.export()));
            dirty = false;
            return;
          }
          try {
            persistNowSync();
          } catch {
            /* ignore */
          }
        },
        { timeoutMs: 30_000 }
      )
    );
  }

  loadFromDiskSync();

  return {
    flush,
    setDeferPersist(value) {
      deferPersist = !!value;
      if (!deferPersist && dirty) persist();
    },
    exec(sql) {
      rawDb.exec(sql);
      persist();
    },
    pragma(statement) {
      rawDb.run(`PRAGMA ${statement}`);
    },
    prepare(sql) {
      return {
        run(...params) {
          rawDb.run(sql, params);
          persist();
          return { changes: rawDb.getRowsModified() };
        },
        get(...params) {
          const stmt = rawDb.prepare(sql);
          try {
            if (params.length) stmt.bind(params);
            if (!stmt.step()) return undefined;
            return stmt.getAsObject();
          } finally {
            stmt.free();
          }
        },
        all(...params) {
          const stmt = rawDb.prepare(sql);
          try {
            if (params.length) stmt.bind(params);
            const rows = [];
            while (stmt.step()) rows.push(stmt.getAsObject());
            return rows;
          } finally {
            stmt.free();
          }
        },
      };
    },
    transaction(fn) {
      return () => {
        rawDb.run('BEGIN TRANSACTION');
        txnDepth += 1;
        try {
          const result = fn();
          rawDb.run('COMMIT');
          txnDepth -= 1;
          persist();
          return result;
        } catch (err) {
          txnDepth -= 1;
          try {
            rawDb.run('ROLLBACK');
          } catch (_) {
            /* ignore */
          }
          throw err;
        }
      };
    },
  };
}

async function openDatabase(dbPath) {
  const SQL = await loadSqlModule();
  return createWrapper(SQL, dbPath);
}

module.exports = { openDatabase, findWasmPath, quarantineCorruptDb };
