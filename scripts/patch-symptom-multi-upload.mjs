import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const screenDir = path.join(__dirname, '../SRC/Screen');

const screens = [
  ['AllergiesScreen.jsx', 'Allergies'],
  ['BreathingProblems.jsx', 'Breathing Problems'],
  ['ChestPainScreen.jsx', 'Chest Pain'],
  ['CoughColdScreen.jsx', 'Cough & Cold'],
  ['DentalPainScreen.jsx', 'Dental Pain'],
  ['DiarrheaConstipationScreen.jsx', 'Diarrhea & Constipation'],
  ['EyeProblems.jsx', 'Eye Problems'],
  ['FeverChillsScreen.jsx', 'Fever & Chills'],
  ['GeneralFatigueScreen.jsx', 'General Fatigue'],
  ['HeadacheMigraineScreen.jsx', 'Headache & Migraine'],
  ['JointMusclePainScreen.jsx', 'Joint & Muscle Pain'],
  ['MentalHealthScreen.jsx', 'Mental Health'],
  ['SkinIssuesScreen.jsx', 'Skin Issues'],
  ['StomachPain.jsx', 'Stomach Pain'],
  ['VomitingNauseaScreen.jsx', 'Vomiting & Nausea'],
];

for (const [file, condition] of screens) {
  const fp = path.join(screenDir, file);
  let s = fs.readFileSync(fp, 'utf8');

  if (s.includes('uploadSymptomGalleryImages')) {
    console.log('skip', file);
    continue;
  }

  s = s.replace(
    /import \* as FileSystem from 'expo-file-system';\n/g,
    ''
  );
  s = s.replace(
    /import \{ analyzeSymptomFromImage, analyzeSymptomFromText \} from '\.\.\/services\/symptomAnalysis';/,
    `import MultiImagePreview from '../Components/MultiImagePreview';\nimport { analyzeSymptomFromText } from '../services/symptomAnalysis';\nimport { uploadSymptomCameraPhoto, uploadSymptomGalleryImages } from '../services/symptomScreenUpload';`
  );
  s = s.replace(
    /const \[selectedImage, setSelectedImage\] = useState\(null\);/,
    'const [selectedImages, setSelectedImages] = useState([]);'
  );

  s = s.replace(
    /\/\/ Analyze Image with Gemini[\s\S]*?\/\/ Pick Image/,
    '// Pick Image'
  );

  const pickBlock = `  const pickImage = async () => {
    await uploadSymptomGalleryImages({
      condition: '${condition}',
      setIsAnalyzing,
      setAnalysisResult,
      setSelectedImages,
    });
  };

  const takePhoto = async () => {
    await uploadSymptomCameraPhoto({
      condition: '${condition}',
      setIsAnalyzing,
      setAnalysisResult,
      setSelectedImages,
    });
  };`;

  s = s.replace(
    /  const pickImage = async \(\) => \{[\s\S]*?  \};\n\n  \/\/ Take Photo\n  const takePhoto = async \(\) => \{[\s\S]*?  \};\n/,
    `${pickBlock}\n`
  );

  s = s.replace(
    /\{selectedImage && \([\s\S]*?\)\}/,
    `{selectedImages.length > 0 && (
            <MultiImagePreview uris={selectedImages} onClear={() => setSelectedImages([])} />
          )}`
  );

  fs.writeFileSync(fp, s);
  console.log('patched', file);
}
