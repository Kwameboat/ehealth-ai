const fs = require('fs');
const path = require('path');

function sleepMs(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    /* sync wait for short lock retry */
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
    /* sql.js not installed yet */
  }
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error(
    'sql-wasm.wasm not found. Run: npm install sql.js --prefix backend (or copy wasm to backend/db/)'
  );
}

/**
 * better-sqlite3-compatible wrapper around sql.js (no native .node / GLIBC).
 */
function createWrapper(SQL, dbPath) {
  let rawDb;
  let lastLoadMtime = 0;

  function loadFromDisk() {
    if (fs.existsSync(dbPath)) {
      rawDb = new SQL.Database(fs.readFileSync(dbPath));
      lastLoadMtime = fs.statSync(dbPath).mtimeMs;
    } else {
      rawDb = new SQL.Database();
      lastLoadMtime = 0;
    }
  }

  function reloadFromDisk() {
    if (!fs.existsSync(dbPath)) return;
    const mtime = fs.statSync(dbPath).mtimeMs;
    if (mtime > lastLoadMtime) {
      rawDb.close();
      loadFromDisk();
    }
  }

  function persist() {
    const lockFile = `${dbPath}.lock`;
    const tmpFile = `${dbPath}.tmp`;
    let attempts = 0;
    while (attempts < 20) {
      try {
        fs.writeFileSync(lockFile, String(process.pid), { flag: 'wx' });
        break;
      } catch (e) {
        if (e.code !== 'EEXIST') throw e;
        attempts += 1;
        sleepMs(25);
      }
    }
    if (attempts >= 20) {
      throw new Error('Database busy (could not acquire lock). Try again.');
    }
    try {
      const data = rawDb.export();
      const buf = Buffer.from(data);
      fs.writeFileSync(tmpFile, buf);
      try {
        fs.renameSync(tmpFile, dbPath);
      } catch (renameErr) {
        fs.writeFileSync(dbPath, buf);
        try {
          fs.unlinkSync(tmpFile);
        } catch (_) {
          /* ignore */
        }
      }
      lastLoadMtime = fs.statSync(dbPath).mtimeMs;
    } finally {
      try {
        fs.unlinkSync(lockFile);
      } catch (_) {
        /* ignore */
      }
    }
  }

  loadFromDisk();

  return {
    reloadFromDisk,
    exec(sql) {
      reloadFromDisk();
      rawDb.exec(sql);
      persist();
    },
    pragma(statement) {
      reloadFromDisk();
      rawDb.run(`PRAGMA ${statement}`);
    },
    prepare(sql) {
      return {
        run(...params) {
          reloadFromDisk();
          rawDb.run(sql, params);
          persist();
          return { changes: rawDb.getRowsModified() };
        },
        get(...params) {
          reloadFromDisk();
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
          reloadFromDisk();
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
        reloadFromDisk();
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

  const SQL = await initSqlJs({
    locateFile: () => wasmPath,
  });

  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  return createWrapper(SQL, dbPath);
}

module.exports = { openDatabase, findWasmPath };
