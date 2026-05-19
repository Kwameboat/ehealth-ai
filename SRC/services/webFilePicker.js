import { Alert } from 'react-native';

const MAX_BYTES = 8 * 1024 * 1024;

/**
 * Open file input synchronously inside a user gesture (required on iOS Safari).
 */
export function openWebFileInput({ accept, capture }) {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') {
      resolve(null);
      return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    if (capture) {
      input.setAttribute('capture', capture);
    }

    Object.assign(input.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '2px',
      height: '2px',
      opacity: '0.01',
      zIndex: '2147483647',
      fontSize: '16px',
    });

    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      try {
        input.remove();
      } catch (_) {
        /* ignore */
      }
      resolve(value);
    };

    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) {
        finish(null);
        return;
      }
      if (file.size > MAX_BYTES) {
        Alert.alert('File too large', 'Please use a file under 8 MB.');
        finish(null);
        return;
      }
      const isPdf =
        file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      finish({
        type: isPdf ? 'pdf' : 'image',
        name: file.name || (isPdf ? 'document.pdf' : 'photo.jpg'),
        uri: URL.createObjectURL(file),
        file,
        mimeType: file.type || (isPdf ? 'application/pdf' : 'image/jpeg'),
        size: file.size,
      });
    });

    document.body.appendChild(input);
    try {
      input.click();
    } catch (e) {
      finish(null);
      return;
    }

    window.setTimeout(() => finish(null), 120000);
  });
}

/**
 * Mobile web: menu so each option runs input.click() in its own tap handler.
 */
export function pickWebAttachmentMenu() {
  return new Promise((resolve) => {
    Alert.alert('Attach file', 'Choose photo or PDF', [
      {
        text: 'Photo library',
        onPress: () => {
          openWebFileInput({ accept: 'image/*' }).then(resolve);
        },
      },
      {
        text: 'Take photo',
        onPress: () => {
          openWebFileInput({ accept: 'image/*', capture: 'environment' }).then(resolve);
        },
      },
      {
        text: 'PDF document',
        onPress: () => {
          openWebFileInput({ accept: 'application/pdf,.pdf' }).then(resolve);
        },
      },
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
    ]);
  });
}
