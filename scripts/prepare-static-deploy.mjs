/**
 * Static cPanel bundle — PWA + admin UI only (API on Railway).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const out = path.join(root, 'deploy-bundle');

function rimraf(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

function copyDir(src, dest, skip = new Set()) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    if (skip.has(name)) continue;
    const s = path.join(src, name);
    const d = path.join(dest, name);
    if (fs.statSync(s).isDirectory()) copyDir(s, d, skip);
    else fs.copyFileSync(s, d);
  }
}

function copyFile(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

rimraf(out);
fs.mkdirSync(out, { recursive: true });

copyDir(path.join(root, 'dist'), path.join(out, 'dist'));
copyDir(path.join(root, 'public'), path.join(out, 'public'));
copyDir(path.join(root, 'assets'), path.join(out, 'assets'));
copyDir(path.join(root, 'backend', 'public', 'admin'), path.join(out, 'public', 'admin'));
copyDir(path.join(root, 'backend', 'public', 'payment'), path.join(out, 'public', 'payment'));

copyFile(path.join(root, 'public_html-static.htaccess'), path.join(out, 'public_html.htaccess'));
copyFile(path.join(root, 'cpanel', 'publish-static-pwa.sh'), path.join(out, 'cpanel', 'publish-static-pwa.sh'));

fs.writeFileSync(
  path.join(out, 'DEPLOYED_AT.txt'),
  `Static PWA build: ${new Date().toISOString()}\nCommit: ${process.env.GITHUB_SHA || 'local'}\nAPI: Railway\n`
);

console.log('Static deploy-bundle ready at', out);
