const fs = require('fs');
const path = require('path');

const fp = path.join(__dirname, '../SRC/Screen/MedicalVoiceAgentScreen.jsx');
let c = fs.readFileSync(fp, 'utf8');

c = c.replace(
  /const GEMINI_API_KEY = "[^"]+";\r?\nconst GEMINI_URL = `[^`]+`;\r?\n\r?\n/,
  "import { generateContent } from '../services/geminiClient';\n\n"
);

c = c.replace(
  /const res = await fetch\(GEMINI_URL, \{\s*method: "POST",\s*headers: \{ "Content-Type": "application\/json" \},\s*body: JSON\.stringify\(\{ contents \}\),\s*\}\);\s*\r?\n\s*const data = await res\.json\(\);/,
  'const data = await generateContent({ contents });'
);

fs.writeFileSync(fp, c);
console.log('Updated MedicalVoiceAgentScreen.jsx');
