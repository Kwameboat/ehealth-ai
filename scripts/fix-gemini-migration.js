const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '../SRC/Screen');
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.jsx'));

for (const file of files) {
  const fp = path.join(dir, file);
  let c = fs.readFileSync(fp, 'utf8');
  if (!c.includes('generateContent')) continue;

  c = c.replace(/\}\)\s*\);\s*\r?\n\s*const data = await response\.json\(\);/g, '});');
  c = c.replace(/\n\s*const data = await response\.json\(\);\s*\r?\n/g, '\n');

  fs.writeFileSync(fp, c);
  console.log('Fixed', file);
}
