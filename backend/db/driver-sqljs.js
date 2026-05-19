const fs = require('fs');
const path = require('path');

/**
 * better-sqlite3-compatible wrapper around sql.js (no native .node / GLIBC).
 */
function createWrapper(rawDb, persist) {
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
  const sqlJsRoot = path.dirname(require.resolve('sql.js/package.json'));
  const wasmPath = path.join(sqlJsRoot, 'dist', 'sql-wasm.wasm');

  const SQL = await initSqlJs({
    locateFile: () => wasmPath,
  });

  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  let rawDb;
  if (fs.existsSync(dbPath)) {
    rawDb = new SQL.Database(fs.readFileSync(dbPath));
  } else {
    rawDb = new SQL.Database();
  }

  const persist = () => {
    const data = rawDb.export();
    fs.writeFileSync(dbPath, Buffer.from(data));
  };

  return createWrapper(rawDb, persist);
}

module.exports = { openDatabase };
