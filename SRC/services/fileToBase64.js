import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

const MAX_BYTES = 8 * 1024 * 1024;

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Failed to read file'));
        return;
      }
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
    reader.readAsDataURL(blob);
  });
}

function stripBase64Payload(value) {
  if (!value || typeof value !== 'string') return '';
  const trimmed = value.replace(/\s/g, '');
  return trimmed.includes(',') ? trimmed.split(',').pop() : trimmed;
}

/**
 * Read attachment for API upload (web File/Blob or native uri).
 * @param {{ uri?: string, file?: File | Blob, mimeType?: string, name?: string }} attachment
 */
export async function attachmentToBase64(attachment) {
  if (!attachment) {
    throw new Error('No attachment');
  }

  if (attachment.file) {
    const file = attachment.file;
    if (file.size > MAX_BYTES) {
      throw new Error('File is too large. Please use a file under 8 MB.');
    }
    return blobToBase64(file);
  }

  if (Platform.OS === 'web' && attachment.uri) {
    try {
      const response = await fetch(attachment.uri);
      if (!response.ok) {
        throw new Error(`Could not read file (${response.status})`);
      }
      const blob = await response.blob();
      if (blob.size > MAX_BYTES) {
        throw new Error('File is too large. Please use a file under 8 MB.');
      }
      return blobToBase64(blob);
    } catch (err) {
      throw new Error(err.message || 'Could not read the selected file on web');
    }
  }

  if (attachment.uri) {
    const base64 = await FileSystem.readAsStringAsync(attachment.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return stripBase64Payload(base64);
  }

  throw new Error('No file data available');
}

/** @deprecated Prefer attachmentToBase64 */
export async function fileUriToBase64(uri) {
  return attachmentToBase64({ uri });
}

export function guessImageMimeType(uri, fallback = 'image/jpeg') {
  const lower = (uri || '').toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.heic')) return 'image/heic';
  return fallback;
}
