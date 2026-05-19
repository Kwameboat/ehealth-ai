const fs = require('fs');
const path = require('path');

/**
 * Canonical writable DB location on cPanel (backend/db/ is often read-only after FTP).
 */
function getDefaultDataPath() {
  const appRoot = path.join(__dirname, '..', '..');
  return path.join(appRoot, 'data', 'medassistant.db');
}

function resolveDatabasePath() {
  const dataPath = getDefaultDataPath();
  const legacyPaths = [
    process.env.DATABASE_PATH ? path.resolve(process.env.DATABASE_PATH) : null,
    path.join(__dirname, 'medassistant.db'),
  ].filter(Boolean);

  const dataDir = path.dirname(dataPath);
  if (isDirWritable(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    migrateLegacyIfNeeded(dataPath, legacyPaths);
    const envPath = process.env.DATABASE_PATH ? path.resolve(process.env.DATABASE_PATH) : null;
    if (envPath && envPath !== dataPath && !envPath.replace(/\\/g, '/').includes('/data/')) {
      console.warn(
        `[db] Using ${dataPath} — set cPanel DATABASE_PATH to this path (was ${envPath})`
      );
    }
    return dataPath;
  }

  for (const dbPath of legacyPaths) {
    if (dbPath && isDirWritable(path.dirname(dbPath))) {
      console.warn(`[db] Using legacy path ${dbPath} — prefer ${dataPath}`);
      return dbPath;
    }
  }

  fs.mkdirSync(dataDir, { recursive: true });
  return dataPath;
}

function isDirWritable(dir) {
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.accessSync(dir, fs.constants.W_OK);
    const test = path.join(dir, `.writetest-${process.pid}-${Date.now()}`);
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
        console.log(`[db] Migrated ${legacy} -> ${targetPath}`);
        return;
      } catch (err) {
        console.warn(`[db] Could not migrate ${legacy}:`, err.message);
      }
    }
  }
}

module.exports = { resolveDatabasePath, getDefaultDataPath };
