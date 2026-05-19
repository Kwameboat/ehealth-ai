/**
 * Desktop web: single file picker (mobile uses webFilePicker menu).
 */
import { openWebFileInput } from './webFilePicker';

export function pickAttachmentWeb() {
  return openWebFileInput({
    accept:
      'image/jpeg,image/png,image/webp,image/gif,application/pdf,.jpg,.jpeg,.png,.webp,.pdf',
  }).then((asset) => {
    if (!asset) return { canceled: true };
    return {
      canceled: false,
      type: asset.type,
      asset: {
        uri: asset.uri,
        file: asset.file,
        name: asset.name,
        mimeType: asset.mimeType,
        size: asset.size,
      },
    };
  });
}
