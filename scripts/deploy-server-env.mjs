/**
 * Upload backend/.env to server (local file only, never committed).
 */
import { Client } from 'ssh2';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '..', 'backend', '.env');

if (!fs.existsSync(envPath)) {
  console.error('Missing backend/.env locally');
  process.exit(1);
}

let content = fs.readFileSync(envPath, 'utf8');
content = content
  .replace(/^HOST=.*/m, 'HOST=0.0.0.0')
  .replace(/^NODE_ENV=.*/m, '')
  .replace(/^ALLOWED_ORIGINS=.*/m, 'ALLOWED_ORIGINS=https://ehealthaigh.com,https://www.ehealthaigh.com,http://205.209.114.146')
  .replace(/^PORT=.*/m, 'PORT=' + (process.env.PORT || ''));
if (!/^NODE_ENV=/m.test(content)) content = 'NODE_ENV=production\n' + content;
if (!/DATABASE_PATH=/m.test(content)) {
  content += '\nDATABASE_PATH=/home/ehealtha/ehealth-ai/backend/db/medassistant.db\n';
}
if (!/WEB_DIST_PATH=/m.test(content)) {
  content += 'WEB_DIST_PATH=/home/ehealtha/ehealth-ai/dist\n';
}

const conn = new Client();
const password = process.env.SSH_PASSWORD;
if (!password) {
  console.error('Set SSH_PASSWORD');
  process.exit(1);
}

conn
  .on('ready', () => {
    conn.exec(`cat > ~/ehealth-ai/backend/.env << 'ENVEOF'\n${content}\nENVEOF\nchmod 600 ~/ehealth-ai/backend/.env`, (err, stream) => {
      stream.on('close', (code) => {
        console.log(code === 0 ? 'backend/.env uploaded' : 'failed');
        conn.end();
        process.exit(code);
      });
      stream.stderr.on('data', (d) => process.stderr.write(d));
    });
  })
  .connect({
    host: process.env.SSH_HOST || '205.209.114.146',
    port: Number(process.env.SSH_PORT || 22),
    username: process.env.SSH_USERNAME || 'ehealtha',
    password,
  });
