/**
 * Copies production files into deploy-bundle/ for FTP upload.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const out = path.join(root, 'deploy-bundle');

const COPY_DIRS = ['dist', 'public', 'backend', 'assets', 'SRC', 'cpanel'];
const COPY_FILES = [
  'server.js',
  'public_html.htaccess',
  'package.json',
  'package-lock.json',
  'app.json',
  'DEPLOY.md',
  'README.md',
  '.env.example',
  'backend/.env.example',
  'scripts/cpanel-post-deploy.sh',
];

function rimraf(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    if (name === 'node_modules' || name === '.git') continue;
    const s = path.join(src, name);
    const d = path.join(dest, name);
    if (fs.statSync(s).isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

rimraf(out);
fs.mkdirSync(out, { recursive: true });

for (const dir of COPY_DIRS) copyDir(path.join(root, dir), path.join(out, dir));
for (const file of COPY_FILES) {
  const src = path.join(root, file);
  if (fs.existsSync(src)) {
    const dest = path.join(out, file);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

fs.writeFileSync(
  path.join(out, 'DEPLOYED_AT.txt'),
  `Built: ${new Date().toISOString()}\nCommit: ${process.env.GITHUB_SHA || 'local'}\n`
);

console.log('deploy-bundle ready at', out);
