import { Alert, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { pickAttachmentWeb } from './pickAttachment.web';
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

/**
 * Open photo/PDF picker (works on native app and mobile web PWA).
 * @returns {Promise<object|null>}
 */
export async function pickChatAttachment() {
  if (Platform.OS === 'web') {
    const result = await pickAttachmentWeb();
    if (result.canceled || !result.asset) return null;
    if (result.asset.size > MAX_BYTES) {
      Alert.alert('File too large', 'Please use a file under 8 MB.');
      return null;
    }
    return {
      type: result.type,
      name: result.asset.name,
      uri: result.asset.uri,
      file: result.asset.file,
      mimeType: result.asset.mimeType,
      size: result.asset.size,
    };
  }
  return pickNativeAttachment();
}
