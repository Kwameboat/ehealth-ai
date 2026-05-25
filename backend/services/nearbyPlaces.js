/**
 * Find hospitals/clinics near coordinates via OpenStreetMap Overpass API.
 */

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(km) {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

function buildAddress(tags) {
  if (tags['addr:full']) return tags['addr:full'];
  const parts = [
    tags['addr:housenumber'],
    tags['addr:street'],
    tags['addr:city'] || tags['addr:town'] || tags['addr:suburb'],
    tags['addr:state'],
    tags['addr:country'],
  ].filter(Boolean);
  return parts.length ? parts.join(', ') : tags.name || 'Address not listed';
}

function normalizeElement(el, originLat, originLon) {
  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  if (lat == null || lon == null) return null;

  const tags = el.tags || {};
  const name = tags.name || tags['name:en'] || 'Medical facility';
  const amenity = tags.amenity || 'hospital';
  const km = haversineKm(originLat, originLon, lat, lon);

  return {
    id: String(el.id),
    name,
    address: buildAddress(tags),
    latitude: lat,
    longitude: lon,
    distance: formatDistance(km),
    distanceKm: km,
    phone: tags.phone || tags['contact:phone'] || null,
    emergency: amenity === 'hospital' || tags.emergency === 'yes',
    amenity,
    waitTime: null,
  };
}

async function fetchOverpass(lat, lon, radiusMeters) {
  const query = `
[out:json][timeout:25];
(
  node["amenity"="hospital"](around:${radiusMeters},${lat},${lon});
  way["amenity"="hospital"](around:${radiusMeters},${lat},${lon});
  node["amenity"="clinic"](around:${radiusMeters},${lat},${lon});
  way["amenity"="clinic"](around:${radiusMeters},${lat},${lon});
  node["healthcare"="hospital"](around:${radiusMeters},${lat},${lon});
  way["healthcare"="hospital"](around:${radiusMeters},${lat},${lon});
);
out center tags 20;
`;

  const res = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
  });

  if (!res.ok) {
    throw new Error(`Map service error (${res.status})`);
  }

  const data = await res.json();
  return data.elements || [];
}

/**
 * @param {{ latitude: number, longitude: number, radiusMeters?: number }} opts
 */
async function findNearbyHospitals({ latitude, longitude, radiusMeters = 20000 }) {
  const elements = await fetchOverpass(latitude, longitude, radiusMeters);
  const places = elements
    .map((el) => normalizeElement(el, latitude, longitude))
    .filter(Boolean)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, 15);

  return {
    hospitals: places,
    source: 'openstreetmap',
    count: places.length,
  };
}

module.exports = { findNearbyHospitals, haversineKm, formatDistance };
