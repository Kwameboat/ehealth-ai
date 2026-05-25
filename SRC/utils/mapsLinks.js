import { Linking, Platform } from 'react-native';

/**
 * Open turn-by-turn directions (Google Maps on web/Android, Apple Maps on iOS).
 */
export function openDirections({ latitude, longitude, address, name }) {
  let dest;
  if (latitude != null && longitude != null) {
    dest = `${latitude},${longitude}`;
  } else {
    dest = encodeURIComponent(address || name || 'hospital');
  }

  const url =
    Platform.OS === 'ios'
      ? `http://maps.apple.com/?daddr=${dest}`
      : `https://www.google.com/maps/dir/?api=1&destination=${dest}`;

  return Linking.openURL(url);
}

/** Search hospitals near coordinates in Google Maps */
export function openHospitalMapSearch(latitude, longitude) {
  const url = `https://www.google.com/maps/search/hospitals/@${latitude},${longitude},14z`;
  return Linking.openURL(url);
}

export function openMapsSearchUrl(url) {
  if (!url) return Promise.reject(new Error('No map URL'));
  return Linking.openURL(url);
}
