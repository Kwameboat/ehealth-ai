const fs = require('fs');

const DEFAULT_STALE_MS = 20_000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isProcessAlive(pid) {
  if (!pid || pid === process.pid) return true;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function readLockMeta(lockPath) {
  try {
    return JSON.parse(fs.readFileSync(lockPath, 'utf8'));
  } catch {
    return null;
  }
}

function isStaleLock(lockPath, staleMs) {
  try {
    const meta = readLockMeta(lockPath);
    if (meta?.at && Date.now() - meta.at > staleMs) return true;
    if (meta?.pid && !isProcessAlive(meta.pid)) return true;
    const stat = fs.statSync(lockPath);
    return Date.now() - stat.mtimeMs > staleMs;
  } catch {
    return true;
  }
}

function releaseLock(lockPath) {
  try {
    const meta = readLockMeta(lockPath);
    if (!meta || meta.pid === process.pid) {
      fs.unlinkSync(lockPath);
    }
  } catch {
    /* ignore */
  }
}

/**
 * Cross-process exclusive lock (O_EXCL create). Required for sql.js on Passenger.
 */
async function withFileLock(lockPath, fn, { timeoutMs = 25_000, staleMs = DEFAULT_STALE_MS } = {}) {
  const start = Date.now();
  while Date.now() - start < timeoutMs) {
    try {
      const fd = fs.openSync(lockPath, 'wx');
      try {
        fs.writeSync(
          fd,
          JSON.stringify({ pid: process.pid, at: Date.now(), host: require('os').hostname() })
        );
      } finally {
        fs.closeSync(fd);
      }
      try {
        return await fn();
      } finally {
        releaseLock(lockPath);
      }
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
      if (isStaleLock(lockPath, staleMs)) {
        try {
          fs.unlinkSync(lockPath);
        } catch {
          /* ignore */
        }
        continue;
      }
      await sleep(80 + Math.floor(Math.random() * 60));
    }
  }
  throw new Error(`DB lock timeout (${lockPath})`);
}

module.exports = { withFileLock, releaseLock, isStaleLock };
