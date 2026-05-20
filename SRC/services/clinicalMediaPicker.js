/**
 * Shared clinical upload pickers — multi-select gallery/PDF, single camera photo.
 */
import * as ImagePicker from 'expo-image-picker';
import { pickPdfDocument } from './pickPdf';
import { guessImageMimeType } from './fileToBase64';

export const MAX_UPLOAD_FILES = 6;
export const MAX_FILE_BYTES = 8 * 1024 * 1024;

const GALLERY_OPTS = {
  mediaTypes: ImagePicker.MediaTypeOptions.Images,
  allowsMultipleSelection: true,
  allowsEditing: false,
  quality: 0.85,
};

const CAMERA_OPTS = {
  mediaTypes: ImagePicker.MediaTypeOptions.Images,
  allowsEditing: false,
  quality: 0.85,
};

function normalizeImageAsset(asset) {
  if (!asset?.uri) return null;
  return {
    uri: asset.uri,
    file: asset.file,
    name: asset.fileName || asset.name || 'photo.jpg',
    mimeType: asset.mimeType || guessImageMimeType(asset.uri, asset.fileName),
    size: asset.size,
    kind: 'image',
  };
}

function normalizePdfAsset(asset) {
  if (!asset?.uri && !asset?.file) return null;
  return {
    uri: asset.uri,
    file: asset.file,
    name: asset.name || 'document.pdf',
    mimeType: asset.mimeType || 'application/pdf',
    size: asset.size,
    kind: 'pdf',
  };
}

function trimAssets(assets, max = MAX_UPLOAD_FILES) {
  return assets.filter(Boolean).slice(0, max);
}

function rejectOversized(assets) {
  const ok = [];
  for (const a of assets) {
    if (a.size && a.size > MAX_FILE_BYTES) continue;
    ok.push(a);
  }
  return ok;
}

/** @returns {Promise<Array<{ uri, file?, name, mimeType, size?, kind: 'image' }>>} */
export async function pickClinicalGalleryImages() {
  await ImagePicker.requestMediaLibraryPermissionsAsync();
  const result = await ImagePicker.launchImageLibraryAsync(GALLERY_OPTS);
  if (result.canceled || !result.assets?.length) return [];
  const assets = trimAssets(
    rejectOversized(result.assets.map(normalizeImageAsset))
  );
  return assets;
}

/** @returns {Promise<{ uri, file?, name, mimeType, size?, kind: 'image' } | null>} */
export async function takeClinicalPhoto() {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') return null;
  const result = await ImagePicker.launchCameraAsync(CAMERA_OPTS);
  if (result.canceled || !result.assets?.[0]) return null;
  const asset = normalizeImageAsset(result.assets[0]);
  if (asset?.size && asset.size > MAX_FILE_BYTES) return null;
  return asset;
}

/** @returns {Promise<Array<{ uri, file?, name, mimeType, size?, kind: 'pdf' }>>} */
export async function pickClinicalPdfDocuments() {
  const result = await pickPdfDocument({ multiple: true });
  if (result.canceled || !result.assets?.length) return [];
  return trimAssets(rejectOversized(result.assets.map(normalizePdfAsset)));
}
