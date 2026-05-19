const fs = require('fs');
const path = require('path');

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

function createWrapper(SQL, dbPath) {
  let rawDb;

  function loadFromDisk() {
    if (fs.existsSync(dbPath)) {
      rawDb = new SQL.Database(fs.readFileSync(dbPath));
    } else {
      rawDb = new SQL.Database();
    }
  }

  function persist() {
    const buf = Buffer.from(rawDb.export());
    const tmp = `${dbPath}.tmp`;
    fs.writeFileSync(tmp, buf);
    try {
      fs.renameSync(tmp, dbPath);
    } catch (_) {
      fs.writeFileSync(dbPath, buf);
      try {
        fs.unlinkSync(tmp);
      } catch (_) {
        /* ignore */
      }
    }
  }

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

  try {
    fs.accessSync(dir, fs.constants.W_OK);
  } catch {
    throw new Error(`Database directory not writable: ${dir}`);
  }

  return createWrapper(SQL, dbPath);
}

module.exports = { openDatabase, findWasmPath };
