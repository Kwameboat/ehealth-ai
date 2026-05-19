const fs = require('fs');
const path = require('path');

const STALE_LOCK_MS = 60 * 1000;

function clearStaleLock(lockFile) {
  if (!fs.existsSync(lockFile)) return;
  try {
    const age = Date.now() - fs.statSync(lockFile).mtimeMs;
    if (age > STALE_LOCK_MS) fs.unlinkSync(lockFile);
  } catch (_) {
    try {
      fs.unlinkSync(lockFile);
    } catch (_) {
      /* ignore */
    }
  }
}

function findWasmPath() {
  const candidates = [
    path.join(__dirname, 'sql-wasm.wasm'),
    path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'),
    path.join(__dirname, '..', '..', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'),
  ];
  try {
    const pkg = require.resolve('sql.js/package.json');
    candidates.push(path.join(path.dirname(pkg), 'dist', 'sql-wasm.wasm'));
  } catch (_) {
    /* not installed */
  }
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error(
    'sql-wasm.wasm not found — copy to backend/db/sql-wasm.wasm or npm install sql.js'
  );
}

function createWrapper(SQL, dbPath) {
  let rawDb;
  const lockFile = `${dbPath}.lock`;
  const tmpFile = `${dbPath}.tmp`;

  function loadFromDisk() {
    if (fs.existsSync(dbPath)) {
      rawDb = new SQL.Database(fs.readFileSync(dbPath));
    } else {
      rawDb = new SQL.Database();
    }
  }

  function persist() {
    clearStaleLock(lockFile);
    let locked = false;
    try {
      fs.writeFileSync(lockFile, String(process.pid), { flag: 'wx' });
      locked = true;
    } catch (e) {
      if (e.code === 'EEXIST') {
        clearStaleLock(lockFile);
        try {
          fs.writeFileSync(lockFile, String(process.pid), { flag: 'wx' });
          locked = true;
        } catch (_) {
          /* write without lock if another worker holds it briefly */
        }
      } else {
        throw e;
      }
    }
    try {
      const buf = Buffer.from(rawDb.export());
      fs.writeFileSync(tmpFile, buf);
      try {
        fs.renameSync(tmpFile, dbPath);
      } catch (_) {
        fs.writeFileSync(dbPath, buf);
        try {
          fs.unlinkSync(tmpFile);
        } catch (_) {
          /* ignore */
        }
      }
    } finally {
      if (locked) {
        try {
          fs.unlinkSync(lockFile);
        } catch (_) {
          /* ignore */
        }
      }
    }
  }

  clearStaleLock(lockFile);
  loadFromDisk();

  return {
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
        rawDb.run('BEGIN');
        try {
          const result = fn();
          rawDb.run('COMMIT');
          persist();
          return result;
        } catch (err) {
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
  const initSqlJs = require('sql.js');
  const wasmPath = findWasmPath();
  const SQL = await initSqlJs({ locateFile: () => wasmPath });

  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  return createWrapper(SQL, dbPath);
}

module.exports = { openDatabase, findWasmPath };
