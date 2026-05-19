/**
 * One-time helper: ensures symptom screens import shared analysis (run manually if needed).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const screenDir = path.join(__dirname, '..', 'SRC', 'Screen');

const SCREENS = [
  ['HeadacheMigraineScreen.jsx', 'Headache & Migraine'],
  ['FeverChillsScreen.jsx', 'Fever & Chills'],
  ['VomitingNauseaScreen.jsx', 'Vomiting & Nausea'],
  ['CoughColdScreen.jsx', 'Cough & Cold'],
  ['AllergiesScreen.jsx', 'Allergies'],
  ['SkinIssuesScreen.jsx', 'Skin Issues'],
  ['BreathingProblems.jsx', 'Breathing Problems'],
  ['DentalPainScreen.jsx', 'Dental Pain'],
  ['ChestPainScreen.jsx', 'Chest Pain'],
  ['StomachPain.jsx', 'Stomach Pain'],
  ['DiarrheaConstipationScreen.jsx', 'Diarrhea & Constipation'],
  ['JointMusclePainScreen.jsx', 'Joint & Muscle Pain'],
  ['MentalHealthScreen.jsx', 'Mental Health'],
  ['EyeProblems.jsx', 'Eye Problems'],
  ['GeneralFatigueScreen.jsx', 'General Fatigue'],
];

const textFn = (condition) => `  const analyzeTextWithGemini = async (text) => {
    setIsAnalyzing(true);
    setAnalysisResult('');
    try {
      const resultText = await analyzeSymptomFromText({
        condition: '${condition}',
        userText: text,
      });
      setAnalysisResult(resultText);
    } catch (error) {
      console.error('Clinical analysis error:', error);
      Alert.alert('Analysis Error', 'Failed to analyze your symptoms. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };`;

const imageFn = (condition) => `  const analyzeImageWithGemini = async (imageUri) => {
    setIsAnalyzing(true);
    setAnalysisResult('');
    try {
      const base64 = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const mimeType = 'image/jpeg';
      const resultText = await analyzeSymptomFromImage({
        condition: '${condition}',
        base64,
        mimeType,
      });
      setAnalysisResult(resultText);
    } catch (error) {
      console.error('Clinical analysis error:', error);
      Alert.alert('Analysis Error', 'Failed to analyze the image. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };`;

const textRe = /  const analyzeTextWithGemini = async \(text\) => \{[\s\S]*?  \};\n\n/;
const imageRe = /  const analyzeImageWithGemini = async \(imageUri\) => \{[\s\S]*?  \};\n\n/;

for (const [file, condition] of SCREENS) {
  const fp = path.join(screenDir, file);
  let src = fs.readFileSync(fp, 'utf8');

  if (!src.includes('analyzeSymptomFromText')) {
    src = src.replace(
      "import { generateContent } from '../services/geminiClient';",
      "import { analyzeSymptomFromImage, analyzeSymptomFromText } from '../services/symptomAnalysis';"
    );
  }

  if (!textRe.test(src)) {
    console.warn('skip text', file);
  } else {
    src = src.replace(textRe, `${textFn(condition)}\n\n`);
  }

  if (!imageRe.test(src)) {
    console.warn('skip image', file);
  } else {
    src = src.replace(imageRe, `${imageFn(condition)}\n\n`);
  }

  fs.writeFileSync(fp, src);
  console.log('patched', file);
}
