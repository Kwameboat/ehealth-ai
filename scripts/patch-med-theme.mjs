import fs from 'fs';
import path from 'path';

const root = path.join(process.cwd(), 'SRC');

const files = [
  'Components/AppBottomNav.jsx',
  'Components/AppLogo.jsx',
  'Components/SymptomMenuModal.jsx',
  'Components/AttachFileModal.jsx',
  'Components/PwaInstallPrompt.jsx',
  'Screen/AuthScreen.jsx',
  'Screen/BuyPointsScreen.jsx',
  'onboardingscreens/OnboardingScreen.js',
];

for (const rel of files) {
  const fp = path.join(root, rel);
  let s = fs.readFileSync(fp, 'utf8');
  if (s.includes('useMedTheme')) {
    console.log('skip', rel);
    continue;
  }
  s = s.replace(
    /import \{ MED_THEME \} from ['"]\.\.\/constants\/appTheme['"];/,
    "import { useMemo } from 'react';\nimport { useMedTheme } from '../hooks/useMedTheme';"
  );
  s = s.replace(
    /import \{ MED_THEME \} from ['"]\.\.\/\.\.\/constants\/appTheme['"];/,
    "import { useMemo } from 'react';\nimport { useMedTheme } from '../hooks/useMedTheme';"
  );
  if (!s.includes('useMedTheme')) {
    console.log('no import', rel);
    continue;
  }
  s = s.replace(/MED_THEME/g, 'med');
  s = s.replace(
    /^(export default function \w+\([^)]*\) \{)/m,
    '$1\n  const med = useMedTheme();\n  const styles = useMemo(() => createStyles(med), [med.isDarkMode]);'
  );
  s = s.replace(
    /^const (\w+) = \([^)]*\) => \{/m,
    'const $1 = () => {\n  const med = useMedTheme();\n  const styles = useMemo(() => createStyles(med), [med.isDarkMode]);'
  );
  s = s.replace(/const styles = StyleSheet\.create\(\{/, 'const createStyles = (med) => StyleSheet.create({');
  fs.writeFileSync(fp, s);
  console.log('patched', rel);
}
