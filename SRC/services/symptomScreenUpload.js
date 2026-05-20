import { Alert } from 'react-native';
import { pickClinicalGalleryImages, takeClinicalPhoto } from './clinicalMediaPicker';
import { analyzeSymptomFromAssets } from './symptomAnalysis';

/**
 * Gallery upload with multi-select — used by symptom category screens.
 */
export async function uploadSymptomGalleryImages({
  condition,
  setIsAnalyzing,
  setAnalysisResult,
  setSelectedImages,
}) {
  const assets = await pickClinicalGalleryImages();
  if (!assets.length) return;

  setSelectedImages?.(assets.map((a) => a.uri));
  setIsAnalyzing(true);
  setAnalysisResult('');
  try {
    const text = await analyzeSymptomFromAssets({ condition, assets });
    setAnalysisResult(text);
  } catch (error) {
    console.error('Clinical analysis error:', error);
    Alert.alert(
      'Analysis Error',
      error.message || 'Failed to analyze your upload. Please try again.'
    );
  } finally {
    setIsAnalyzing(false);
  }
}

/**
 * Camera capture — single photo, then analyze.
 */
export async function uploadSymptomCameraPhoto({
  condition,
  setIsAnalyzing,
  setAnalysisResult,
  setSelectedImages,
}) {
  const asset = await takeClinicalPhoto();
  if (!asset) {
    Alert.alert('Permission required', 'Camera access is needed to take a photo.');
    return;
  }

  setSelectedImages?.([asset.uri]);
  setIsAnalyzing(true);
  setAnalysisResult('');
  try {
    const text = await analyzeSymptomFromAssets({ condition, assets: [asset] });
    setAnalysisResult(text);
  } catch (error) {
    console.error('Clinical analysis error:', error);
    Alert.alert(
      'Analysis Error',
      error.message || 'Failed to analyze the image. Please try again.'
    );
  } finally {
    setIsAnalyzing(false);
  }
}
