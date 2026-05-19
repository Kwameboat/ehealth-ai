/**
 * Chat attach — same approach as prefilled symptom screens (expo-image-picker + document picker).
 */
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { pickPdfDocument } from './pickPdf';
import { guessImageMimeType } from './fileToBase64';

const MAX_BYTES = 8 * 1024 * 1024;

function assetFromImageResult(result) {
  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  return {
    type: 'image',
    name: asset.fileName || 'photo.jpg',
    uri: asset.uri,
    mimeType: asset.mimeType || guessImageMimeType(asset.uri || asset.fileName),
    size: asset.size,
  };
}

/** Gallery — matches symptom screen pickImage(). */
async function pickFromGallery() {
  await ImagePicker.requestMediaLibraryPermissionsAsync();
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [4, 3],
    quality: 0.85,
  });
  return assetFromImageResult(result);
}

/** Camera — matches symptom screen takePhoto(). */
async function pickFromCamera() {
  await ImagePicker.requestCameraPermissionsAsync();
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [4, 3],
    quality: 0.85,
  });
  return assetFromImageResult(result);
}

async function pickPdf() {
  const result = await pickPdfDocument();
  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  if (asset.size && asset.size > MAX_BYTES) {
    Alert.alert('File too large', 'Please choose a PDF under 8 MB.');
    return null;
  }
  return {
    type: 'pdf',
    name: asset.name,
    uri: asset.uri,
    file: asset.file,
    mimeType: asset.mimeType || 'application/pdf',
    size: asset.size,
  };
}

/**
 * Show Gallery / Camera / PDF menu (same pattern as symptom category screens).
 * @returns {Promise<object|null>}
 */
export function pickChatAttachment() {
  return new Promise((resolve) => {
    Alert.alert('Attach file', 'Upload a photo or PDF for analysis', [
      { text: 'Gallery', onPress: () => pickFromGallery().then(resolve) },
      { text: 'Camera', onPress: () => pickFromCamera().then(resolve) },
      { text: 'PDF document', onPress: () => pickPdf().then(resolve) },
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
    ]);
  });
}
