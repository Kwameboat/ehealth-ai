/**
 * Upload deploy-bundle to server via SFTP (SSH port 22).
 * Usage: SSH_PASSWORD=... node scripts/deploy-sftp.mjs
 */
import { Client } from 'ssh2';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const localDir = path.join(root, 'deploy-bundle');
const remoteDir = process.env.SFTP_REMOTE_DIR || 'ehealth-ai';

const host = process.env.SSH_HOST || '205.209.114.146';
const username = process.env.SSH_USERNAME || 'ehealtha';
const password = process.env.SSH_PASSWORD;
const port = Number(process.env.SSH_PORT || 22);

if (!password) {
  console.error('Set SSH_PASSWORD');
  process.exit(1);
}
if (!fs.existsSync(localDir)) {
  console.error('Run: npm run build:web && node scripts/prepare-deploy.mjs');
  process.exit(1);
}

function walk(dir) {
  const entries = [];
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) entries.push(...walk(full));
    else entries.push(full);
  }
  return entries;
}

const conn = new Client();

conn
  .on('ready', () => {
    conn.sftp((err, sftp) => {
      if (err) throw err;

      const mkdirp = (remote, cb) => {
        sftp.stat(remote, (e) => {
          if (!e) return cb();
          const parent = path.posix.dirname(remote);
          if (parent === '.' || parent === '/') return sftp.mkdir(remote, cb);
          mkdirp(parent, () => sftp.mkdir(remote, cb));
        });
      };

      const files = walk(localDir);
      let i = 0;

      const next = () => {
        if (i >= files.length) {
          console.log(`Uploaded ${files.length} files to ~/${remoteDir}`);
          conn.end();
          return;
        }
        const file = files[i++];
        const rel = path.relative(localDir, file).split(path.sep).join('/');
        const remote = `${remoteDir}/${rel}`;
        mkdirp(path.posix.dirname(remote), () => {
          sftp.fastPut(file, remote, (e) => {
            if (e) console.error('FAIL', remote, e.message);
            else process.stdout.write('.');
            next();
          });
        });
      };

      mkdirp(remoteDir, next);
    });
  })
  .on('error', (e) => {
    console.error(e.message);
    process.exit(1);
  })
  .connect({ host, port, username, password, readyTimeout: 60000 });
