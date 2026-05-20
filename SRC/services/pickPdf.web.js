/**
 * Web PDF picker (avoids expo-document-picker Metro issues on web).
 * @returns {Promise<{ canceled: boolean, assets?: Array<{ uri: string, name: string, size?: number, mimeType: string }> }>}
 */
/**
 * @param {{ multiple?: boolean }} [options]
 */
export function pickPdfDocument(options = {}) {
  const allowMultiple = options.multiple !== false;
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/pdf,.pdf';
    if (allowMultiple) input.multiple = true;
    input.style.display = 'none';
    document.body.appendChild(input);

    const cleanup = () => {
      input.remove();
    };

    input.onchange = () => {
      const files = input.files ? Array.from(input.files) : [];
      cleanup();
      if (!files.length) {
        resolve({ canceled: true });
        return;
      }
      resolve({
        canceled: false,
        assets: files.map((file) => ({
          uri: URL.createObjectURL(file),
          file,
          name: file.name,
          size: file.size,
          mimeType: file.type || 'application/pdf',
        })),
      });
    };

    input.oncancel = () => {
      cleanup();
      resolve({ canceled: true });
    };

    input.click();
  });
}
