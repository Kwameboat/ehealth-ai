import { Platform } from 'react-native';
import * as Location from 'expo-location';
import { getApiAuthHeadersAsync } from './apiAuth';
import { getApiUrl } from './appConfig';

export const GHANA_EMERGENCY_NUMBERS = [
  { id: '112', label: 'National Emergency', number: '112', subtitle: 'Police, fire, ambulance' },
  { id: '193', label: 'Ambulance', number: '193', subtitle: 'Ghana National Ambulance' },
  { id: '999', label: 'Emergency (alt)', number: '999', subtitle: 'Alternative emergency line' },
];

/**
 * Get device coordinates — works on native and PWA (HTTPS required on web).
 */
export async function getCurrentCoordinates() {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.geolocation) {
      return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (pos) =>
            resolve({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
            }),
          (err) => reject(new Error(err.message || 'Location permission denied')),
          { enableHighAccuracy: true, timeout: 20000, maximumAge: 60000 }
        );
      });
    }
    throw new Error('Location permission is required to find nearby hospitals.');
  }

  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
    timeout: 20000,
  });

  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
  };
}

export async function fetchNearbyHospitals(latitude, longitude) {
  const apiBase = getApiUrl();
  if (!apiBase) {
    throw new Error('Backend not configured');
  }

  const params = new URLSearchParams({
    lat: String(latitude),
    lon: String(longitude),
    radius: '25000',
  });

  const response = await fetch(`${apiBase}/api/emergency/nearby-hospitals?${params}`, {
    headers: await getApiAuthHeadersAsync(),
  });

  const data = await response.json();
  if (!response.ok) {
    const err = new Error(data?.error?.message || 'Failed to find hospitals');
    err.mapsSearchUrl = data.mapsSearchUrl;
    throw err;
  }

  return data;
}
