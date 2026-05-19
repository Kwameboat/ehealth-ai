const fs = require('fs');
const path = require('path');

/**
 * Pick a database path the Node process can write (cPanel often makes backend/db read-only).
 */
function resolveDatabasePath() {
  const appRoot = path.join(__dirname, '..', '..');
  const dataPath = path.join(appRoot, 'data', 'medassistant.db');
  const legacyDbDir = path.join(__dirname, 'medassistant.db');

  const candidates = [];
  if (process.env.DATABASE_PATH) candidates.push(path.resolve(process.env.DATABASE_PATH));
  candidates.push(dataPath, legacyDbDir);

  for (const dbPath of candidates) {
    if (isDirWritable(path.dirname(dbPath))) {
      migrateLegacyIfNeeded(dbPath, [legacyDbDir, path.join(__dirname, 'medassistant.db')]);
      if (dbPath !== process.env.DATABASE_PATH && process.env.DATABASE_PATH) {
        console.warn(
          `DATABASE_PATH not writable (${process.env.DATABASE_PATH}), using ${dbPath}`
        );
      }
      return dbPath;
    }
  }

  const fallbackDir = path.dirname(dataPath);
  fs.mkdirSync(fallbackDir, { recursive: true });
  return dataPath;
}

function isDirWritable(dir) {
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.accessSync(dir, fs.constants.W_OK);
    const test = path.join(dir, `.writetest-${process.pid}`);
    fs.writeFileSync(test, 'ok');
    fs.unlinkSync(test);
    return true;
  } catch {
    return false;
  }
}

function migrateLegacyIfNeeded(targetPath, legacyPaths) {
  if (fs.existsSync(targetPath)) return;
  const dir = path.dirname(targetPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  for (const legacy of legacyPaths) {
    if (legacy && legacy !== targetPath && fs.existsSync(legacy)) {
      try {
        fs.copyFileSync(legacy, targetPath);
        console.log(`Migrated database: ${legacy} -> ${targetPath}`);
        return;
      } catch (err) {
        console.warn(`Could not migrate ${legacy}:`, err.message);
      }
    }
  }
}

module.exports = { resolveDatabasePath };
