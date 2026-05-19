import { Platform } from 'react-native';

/** True in browser/PWA (including static export). */
export function isWebBrowser() {
  return Platform.OS === 'web' || (typeof document !== 'undefined' && typeof window !== 'undefined');
}
