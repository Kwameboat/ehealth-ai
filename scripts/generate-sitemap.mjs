/**
 * Writes public/sitemap.xml from EXPO_PUBLIC_SITE_URL (run before build:web).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SITE = (process.env.EXPO_PUBLIC_SITE_URL || 'https://www.ehealthaigh.com').replace(/\/$/, '');

const urls = [
  { loc: '/', changefreq: 'weekly', priority: '1.0' },
];

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls
  .map(
    (u) => `  <url>
    <loc>${SITE}${u.loc === '/' ? '/' : u.loc}</loc>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`
  )
  .join('\n')}
</urlset>
`;

const out = path.join(__dirname, '..', 'public', 'sitemap.xml');
fs.writeFileSync(out, xml, 'utf8');
console.log('Wrote', out, 'for', SITE);
