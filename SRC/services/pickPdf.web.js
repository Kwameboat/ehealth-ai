/**
 * Web PDF picker (avoids expo-document-picker Metro issues on web).
 * @returns {Promise<{ canceled: boolean, assets?: Array<{ uri: string, name: string, size?: number, mimeType: string }> }>}
 */
export function pickPdfDocument() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/pdf,.pdf';
    input.style.display = 'none';
    document.body.appendChild(input);

    const cleanup = () => {
      input.remove();
    };

    input.onchange = () => {
      const file = input.files?.[0];
      cleanup();
      if (!file) {
        resolve({ canceled: true });
        return;
      }
      resolve({
        canceled: false,
        assets: [
          {
            uri: URL.createObjectURL(file),
            name: file.name,
            size: file.size,
            mimeType: file.type || 'application/pdf',
          },
        ],
      });
    };

    input.oncancel = () => {
      cleanup();
      resolve({ canceled: true });
    };

    input.click();
  });
}
