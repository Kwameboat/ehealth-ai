import { Alert, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { pickPdfDocument } from './pickPdf';
import { pickWebAttachmentMenu, openWebFileInput } from './webFilePicker';
import { guessImageMimeType } from './fileToBase64';
import { isMobileWebUserAgent } from '../utils/deviceUtils';

const MAX_BYTES = 8 * 1024 * 1024;

function assetFromImageResult(result) {
  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  return {
    type: 'image',
    name: asset.fileName || 'photo.jpg',
    uri: asset.uri,
    mimeType: asset.mimeType || guessImageMimeType(asset.uri),
    size: asset.size,
  };
}

async function pickFromLibrary() {
  const lib = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!lib.granted) {
    Alert.alert('Permission needed', 'Photo library access is required.');
    return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    quality: 0.85,
  });
  return assetFromImageResult(result);
}

async function pickFromCamera() {
  const cam = await ImagePicker.requestCameraPermissionsAsync();
  if (!cam.granted) {
    Alert.alert('Permission needed', 'Camera access is required.');
    return null;
  }
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
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

function pickNativeAttachment() {
  return new Promise((resolve) => {
    Alert.alert('Attach file', 'Share a photo or PDF', [
      { text: 'Photo library', onPress: () => pickFromLibrary().then(resolve) },
      { text: 'Take photo', onPress: () => pickFromCamera().then(resolve) },
      { text: 'PDF document', onPress: () => pickPdf().then(resolve) },
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
    ]);
  });
}

async function pickWebAttachment() {
  if (isMobileWebUserAgent()) {
    return pickWebAttachmentMenu();
  }
  return openWebFileInput({
    accept: 'image/jpeg,image/png,image/webp,image/gif,application/pdf,.jpg,.jpeg,.png,.webp,.pdf',
  });
}

/**
 * Open photo/PDF picker (native app + mobile/desktop web).
 * @returns {Promise<object|null>}
 */
export async function pickChatAttachment() {
  if (Platform.OS === 'web') {
    const picked = await pickWebAttachment();
    return picked;
  }
  return pickNativeAttachment();
}
