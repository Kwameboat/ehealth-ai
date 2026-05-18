import * as DocumentPicker from 'expo-document-picker';

/**
 * @returns {Promise<import('expo-document-picker').DocumentPickerResult>}
 */
export async function pickPdfDocument() {
  return DocumentPicker.getDocumentAsync({
    type: 'application/pdf',
    copyToCacheDirectory: true,
    multiple: false,
  });
}
