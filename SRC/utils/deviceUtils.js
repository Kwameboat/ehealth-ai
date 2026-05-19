import { Platform } from 'react-native';

export function getUserAgent() {
  if (typeof navigator !== 'undefined' && navigator.userAgent) {
    return navigator.userAgent;
  }
  return '';
}

export function isIOSUserAgent() {
  return /iPhone|iPad|iPod/i.test(getUserAgent());
}

export function isAndroidUserAgent() {
  return /Android/i.test(getUserAgent());
}

/** Phone/tablet browser (PWA), not desktop. */
export function isMobileWebUserAgent() {
  if (Platform.OS !== 'web') return false;
  return isIOSUserAgent() || isAndroidUserAgent();
}

export function isIOSPlatform() {
  return Platform.OS === 'ios' || (Platform.OS === 'web' && isIOSUserAgent());
}
