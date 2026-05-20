import * as DocumentPicker from 'expo-document-picker';

/**
 * @returns {Promise<import('expo-document-picker').DocumentPickerResult>}
 */
/**
 * @param {{ multiple?: boolean }} [options]
 */
export async function pickPdfDocument(options = {}) {
  return DocumentPicker.getDocumentAsync({
    type: 'application/pdf',
    copyToCacheDirectory: true,
    multiple: options.multiple !== false,
  });
}
