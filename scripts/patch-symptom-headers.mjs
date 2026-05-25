/**
 * Replaces inline symptom screen headers with ScreenHeaderBar.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const screenDir = path.join(__dirname, '..', 'SRC', 'Screen');

const FILES = [
  'AllergiesScreen.jsx',
  'BreathingProblems.jsx',
  'ChestPainScreen.jsx',
  'CoughColdScreen.jsx',
  'DentalPainScreen.jsx',
  'DiarrheaConstipationScreen.jsx',
  'EyeProblems.jsx',
  'FeverChillsScreen.jsx',
  'GeneralFatigueScreen.jsx',
  'HeadacheMigraineScreen.jsx',
  'JointMusclePainScreen.jsx',
  'MentalHealthScreen.jsx',
  'SkinIssuesScreen.jsx',
  'StomachPain.jsx',
  'VomitingNauseaScreen.jsx',
  'LabResultsScreen.jsx',
];

const headerBlockRe =
  /\s*\{\/\* Header \*\/\}\s*\n\s*<View style=\{styles\.header\}>[\s\S]*?<\/View>\s*\n/;

for (const file of FILES) {
  const fp = path.join(screenDir, file);
  let src = fs.readFileSync(fp, 'utf8');

  const titleMatch = src.match(/<Text style=\{styles\.headerTitle\}>([^<]+)<\/Text>/);
  if (!titleMatch) {
    console.warn('Skip (no title):', file);
    continue;
  }
  const title = titleMatch[1].trim();

  if (!src.includes("ScreenHeaderBar")) {
    if (src.includes("import ClinicalAnalysisView")) {
      src = src.replace(
        "import ClinicalAnalysisView",
        "import ScreenHeaderBar from '../Components/ScreenHeaderBar';\nimport ClinicalAnalysisView"
      );
    } else if (src.includes("import MultiImagePreview")) {
      src = src.replace(
        "import MultiImagePreview",
        "import ScreenHeaderBar from '../Components/ScreenHeaderBar';\nimport MultiImagePreview"
      );
    } else {
      src = src.replace(
        /import \{ useTheme \} from '\.\.\/Context\/ThemeContext';/,
        "import ScreenHeaderBar from '../Components/ScreenHeaderBar';\nimport { useTheme } from '../Context/ThemeContext';"
      );
    }
  }

  if (!headerBlockRe.test(src)) {
    console.warn('Skip (no header block):', file);
    continue;
  }

  src = src.replace(
    headerBlockRe,
    `\n      <ScreenHeaderBar title="${title.replace(/"/g, '\\"')}" />\n`
  );

  src = src.replace(/\n  header: \{[\s\S]*?\n  \},\n  backButton: \{[\s\S]*?\n  \},\n  headerTitle: \{[\s\S]*?\n  \},\n/g, '\n');
  src = src.replace(/\n  headerIcon: \{[\s\S]*?\n  \},\n/g, '\n');

  fs.writeFileSync(fp, src);
  console.log('Patched:', file);
}
