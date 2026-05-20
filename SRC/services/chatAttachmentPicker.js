/**
 * Chat attach — multi-select gallery/PDF, single camera (same stack as clinical screens).
 */
import { Alert } from 'react-native';
import {
  pickClinicalGalleryImages,
  pickClinicalPdfDocuments,
  takeClinicalPhoto,
  MAX_FILE_BYTES,
} from './clinicalMediaPicker';
import { guessImageMimeType } from './fileToBase64';

function mapImageAsset(asset) {
  return {
    type: 'image',
    name: asset.name,
    uri: asset.uri,
    file: asset.file,
    mimeType: asset.mimeType || guessImageMimeType(asset.uri, asset.name),
    size: asset.size,
  };
}

function mapPdfAsset(asset) {
  if (asset.size && asset.size > MAX_FILE_BYTES) return null;
  return {
    type: 'pdf',
    name: asset.name,
    uri: asset.uri,
    file: asset.file,
    mimeType: asset.mimeType || 'application/pdf',
    size: asset.size,
  };
}

async function pickFromGallery() {
  const assets = await pickClinicalGalleryImages();
  return assets.map(mapImageAsset).filter(Boolean);
}

async function pickFromCamera() {
  const asset = await takeClinicalPhoto();
  if (!asset) return [];
  return [mapImageAsset(asset)];
}

async function pickPdf() {
  const assets = await pickClinicalPdfDocuments();
  const mapped = assets.map(mapPdfAsset).filter(Boolean);
  if (assets.length && !mapped.length) {
    Alert.alert('File too large', 'Please choose PDFs under 8 MB each.');
  }
  return mapped;
}

/**
 * Show Gallery / Camera / PDF menu.
 * @returns {Promise<object[]>}
 */
export function pickChatAttachments() {
  return new Promise((resolve) => {
    Alert.alert('Attach files', 'Upload one or more photos or PDFs', [
      { text: 'Gallery', onPress: () => pickFromGallery().then(resolve) },
      { text: 'Camera', onPress: () => pickFromCamera().then(resolve) },
      { text: 'PDF document', onPress: () => pickPdf().then(resolve) },
      { text: 'Cancel', style: 'cancel', onPress: () => resolve([]) },
    ]);
  });
}

/** @deprecated Use pickChatAttachments */
export async function pickChatAttachment() {
  const list = await pickChatAttachments();
  return list[0] || null;
}
