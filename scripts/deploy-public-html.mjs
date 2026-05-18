import { Client } from 'ssh2';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const password = process.env.SSH_PASSWORD;
if (!password) {
  console.error('Set SSH_PASSWORD');
  process.exit(1);
}

const htaccess = fs.readFileSync(path.join(__dirname, '..', 'public_html.htaccess'), 'utf8');

const cmd = `
cd ~/ehealth-ai && chmod +x scripts/cpanel-post-deploy.sh 2>/dev/null && bash scripts/cpanel-post-deploy.sh
echo STATIC_OK
`;

const conn = new Client();
conn
  .on('ready', () => {
    conn.exec(cmd, (err, stream) => {
      stream.on('data', (d) => process.stdout.write(d));
      stream.on('close', (c) => {
        conn.end();
        process.exit(c === 0 ? 0 : 1);
      });
    });
  })
  .on('error', (e) => {
    console.error(e.message);
    process.exit(1);
  })
  .connect({
    host: process.env.SSH_HOST || '205.209.114.146',
    port: 22,
    username: process.env.SSH_USERNAME || 'ehealtha',
    password,
  });
