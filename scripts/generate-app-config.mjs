/**
 * Writes public/app-config.js for static cPanel hosting (API on Railway).
 * Env: EXPO_PUBLIC_API_URL or RAILWAY_PUBLIC_URL, APP_API_SECRET or EXPO_PUBLIC_APP_API_SECRET
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const outDir = path.join(root, 'public');
const outFile = path.join(outDir, 'app-config.js');

const apiUrl = (
  process.env.EXPO_PUBLIC_API_URL ||
  process.env.RAILWAY_PUBLIC_URL ||
  process.env.PUBLIC_APP_URL ||
  'https://www.ehealthaigh.com'
).replace(/\/$/, '');

const appApiSecret =
  process.env.EXPO_PUBLIC_APP_API_SECRET || process.env.APP_API_SECRET || '';

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(
  outFile,
  `window.__EHEALTH_CONFIG__=${JSON.stringify({ appApiSecret, apiUrl })};\n`
);

console.log('Wrote', outFile);
console.log('  apiUrl:', apiUrl);
console.log('  appApiSecret:', appApiSecret ? '(set)' : '(empty — set APP_API_SECRET in CI)');
