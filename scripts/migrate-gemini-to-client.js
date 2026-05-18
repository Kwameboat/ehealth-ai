const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '../SRC/Screen');
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.jsx'));

for (const file of files) {
  const fp = path.join(dir, file);
  let c = fs.readFileSync(fp, 'utf8');
  if (!c.includes('GEMINI_API_KEY')) continue;

  const isPro = c.includes('gemini-pro');
  const importLine = isPro
    ? "import { generateContent, GEMINI_MODEL_PRO } from '../services/geminiClient';"
    : "import { generateContent } from '../services/geminiClient';";

  c = c.replace(/const GEMINI_API_KEY = [^;]+;\r?\nconst GEMINI_API_URL = [^;]+;\r?\n\r?\n/, `${importLine}\n\n`);

  c = c.replace(
    /const response = await fetch\(GEMINI_API_URL,\s*\{\s*method: 'POST',\s*headers: \{\s*'Content-Type': 'application\/json',\s*\},\s*body: JSON\.stringify\(\s*/g,
    'const data = await generateContent('
  );

  c = c.replace(/\}\)\s*\);\s*\r?\n\s*const data = await response\.json\(\);/g, isPro ? '}, { model: GEMINI_MODEL_PRO });' : '});');

  fs.writeFileSync(fp, c);
  console.log('Updated', file);
}
