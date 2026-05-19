import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'SRC', 'Screen');
const files = fs.readdirSync(dir).filter(
  (f) =>
    f.endsWith('Screen.jsx') ||
    f === 'StomachPain.jsx' ||
    f === 'BreathingProblems.jsx' ||
    f === 'EyeProblems.jsx'
);

const importLine =
  "import ClinicalAnalysisView from '../Components/ClinicalAnalysisView';";

const renderRe = /  const renderAnalysisResult = \(\) => \{[\s\S]*?  \};\n\n/;

const renderReplace = `  const renderAnalysisResult = () => {
    if (!analysisResult) return null;
    return (
      <ClinicalAnalysisView
        text={analysisResult}
        sectionStyle={styles.sectionContainer}
        sectionTitleStyle={styles.sectionTitle}
        bodyStyle={styles.resultText}
      />
    );
  };

`;

for (const file of files) {
  if (!fs.readFileSync(path.join(dir, file), 'utf8').includes('renderAnalysisResult')) continue;
  let src = fs.readFileSync(path.join(dir, file), 'utf8');
  if (!src.includes('ClinicalAnalysisView')) {
    src = src.replace(
      "import { analyzeSymptomFromImage, analyzeSymptomFromText } from '../services/symptomAnalysis';",
      `import ClinicalAnalysisView from '../Components/ClinicalAnalysisView';\nimport { analyzeSymptomFromImage, analyzeSymptomFromText } from '../services/symptomAnalysis';`
    );
  }
  if (renderRe.test(src)) {
    src = src.replace(renderRe, renderReplace);
    fs.writeFileSync(path.join(dir, file), src);
    console.log('view', file);
  }
}
