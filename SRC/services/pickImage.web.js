/**
 * Web image picker (reliable on PWA; expo-image-picker is inconsistent on web).
 */
export function pickImageFromFiles() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp';
    input.style.display = 'none';
    document.body.appendChild(input);

    const finish = (result) => {
      input.remove();
      resolve(result);
    };

    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        finish({ canceled: true });
        return;
      }
      finish({
        canceled: false,
        assets: [
          {
            uri: URL.createObjectURL(file),
            file,
            name: file.name || 'photo.jpg',
            mimeType: file.type || 'image/jpeg',
            size: file.size,
          },
        ],
      });
    };

    input.click();
  });
}
