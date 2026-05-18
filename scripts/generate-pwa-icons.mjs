/**
 * Generates PWA icons from ehealth-logo.png into public/icons/
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const src = path.join(root, 'assets', 'images', 'ehealth-logo.png');
const fallback = path.join(root, 'assets', 'images', 'icon.png');
const outDir = path.join(root, 'public', 'icons');

const source = fs.existsSync(src) ? src : fallback;
if (!fs.existsSync(source)) {
  console.error('No source image found (ehealth-logo.png or icon.png)');
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });

let sharp;
try {
  sharp = (await import('sharp')).default;
} catch {
  console.warn('sharp not installed — copying source as icons (run: npm install --save-dev sharp)');
  for (const size of [192, 512]) {
    fs.copyFileSync(source, path.join(outDir, `icon-${size}.png`));
  }
  fs.copyFileSync(source, path.join(root, 'public', 'favicon.png'));
  process.exit(0);
}

const sizes = [192, 512];
for (const size of sizes) {
  await sharp(source)
    .resize(size, size, { fit: 'contain', background: { r: 11, g: 18, b: 32, alpha: 1 } })
    .png()
    .toFile(path.join(outDir, `icon-${size}.png`));
  console.log(`Wrote icon-${size}.png`);
}

await sharp(source)
  .resize(48, 48, { fit: 'contain', background: { r: 11, g: 18, b: 32, alpha: 1 } })
  .png()
  .toFile(path.join(root, 'public', 'favicon.png'));
console.log('Wrote favicon.png');
