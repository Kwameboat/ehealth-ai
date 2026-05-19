/**
 * Open file picker in the same user-gesture turn as the + button (required on web).
 * @returns {Promise<{ canceled: boolean, type?: 'image'|'pdf', asset?: object }>}
 */
export function pickAttachmentWeb() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept =
      'image/jpeg,image/png,image/webp,image/gif,application/pdf,.jpg,.jpeg,.png,.webp,.pdf';
    input.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0;';
    document.body.appendChild(input);

    const done = (result) => {
      input.remove();
      resolve(result);
    };

    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) {
        done({ canceled: true });
        return;
      }
      const isPdf =
        file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      done({
        canceled: false,
        type: isPdf ? 'pdf' : 'image',
        asset: {
          uri: URL.createObjectURL(file),
          file,
          name: file.name || (isPdf ? 'document.pdf' : 'photo.jpg'),
          mimeType: file.type || (isPdf ? 'application/pdf' : 'image/jpeg'),
          size: file.size,
        },
      });
    });

    input.addEventListener('cancel', () => done({ canceled: true }));

    // Must run synchronously inside the click/tap handler
    input.click();
  });
}
