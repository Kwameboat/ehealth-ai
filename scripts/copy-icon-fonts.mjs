/**
 * Copies vector-icon TTFs to public/fonts/ for reliable PWA loading on cPanel
 * (long /assets/node_modules/... paths often 404 after deploy).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const fontsDir = path.join(root, 'public', 'fonts');
const srcBase = path.join(
  root,
  'node_modules',
  '@expo',
  'vector-icons',
  'build',
  'vendor',
  'react-native-vector-icons',
  'Fonts'
);

const FONTS = [
  ['MaterialCommunityIcons.ttf', 'MaterialCommunityIcons.ttf'],
  ['Ionicons.ttf', 'Ionicons.ttf'],
  ['Feather.ttf', 'Feather.ttf'],
  ['MaterialIcons.ttf', 'MaterialIcons.ttf'],
  ['FontAwesome5_Solid.ttf', 'FontAwesome5_Solid.ttf'],
  ['FontAwesome5_Regular.ttf', 'FontAwesome5_Regular.ttf'],
];

fs.mkdirSync(fontsDir, { recursive: true });

let copied = 0;
for (const [srcName, destName] of FONTS) {
  const src = path.join(srcBase, srcName);
  const dest = path.join(fontsDir, destName);
  if (!fs.existsSync(src)) {
    console.warn('skip (missing):', srcName);
    continue;
  }
  fs.copyFileSync(src, dest);
  copied += 1;
}

console.log(`Copied ${copied} icon fonts -> public/fonts/`);
