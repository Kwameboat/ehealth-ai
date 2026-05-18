import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

export async function fileUriToBase64(uri) {
  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    const blob = await response.blob();
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

  return FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
}

export function guessImageMimeType(uri) {
  const lower = (uri || '').toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  return 'image/jpeg';
}
