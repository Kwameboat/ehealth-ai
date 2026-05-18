/**
 * Run server bootstrap over SSH (password from SSH_PASSWORD env).
 * Usage: SSH_PASSWORD=... node scripts/deploy-ssh.mjs
 */
import { Client } from 'ssh2';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const host = process.env.SSH_HOST || '205.209.114.146';
const port = Number(process.env.SSH_PORT || 22);
const username = process.env.SSH_USERNAME || 'ehealtha';
const password = process.env.SSH_PASSWORD;

if (!password) {
  console.error('Set SSH_PASSWORD environment variable.');
  process.exit(1);
}

const scriptPath = path.join(__dirname, 'server-bootstrap.sh');
const script = fs.readFileSync(scriptPath, 'utf8');

const conn = new Client();

conn
  .on('ready', () => {
    console.log(`SSH connected to ${host}`);
    const cmd = `mkdir -p ~/ehealth-ai && cat > /tmp/ehealth-bootstrap.sh << 'BOOT_EOF'\n${script}\nBOOT_EOF\nchmod +x /tmp/ehealth-bootstrap.sh && APP_DIR=~/ehealth-ai bash /tmp/ehealth-bootstrap.sh`;
    conn.exec(cmd, (err, stream) => {
      if (err) {
        console.error(err);
        conn.end();
        process.exit(1);
      }
      stream
        .on('close', (code) => {
          console.log(`Bootstrap exit code: ${code}`);
          conn.end();
          process.exit(code === 0 ? 0 : 1);
        })
        .on('data', (d) => process.stdout.write(d))
        .stderr.on('data', (d) => process.stderr.write(d));
    });
  })
  .on('error', (e) => {
    console.error('SSH error:', e.message);
    process.exit(1);
  })
  .connect({ host, port, username, password, readyTimeout: 30000 });
