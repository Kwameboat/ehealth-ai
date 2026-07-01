import { getApiAuthHeadersAsync } from './apiAuth';
import { getApiUrl } from './appConfig';
import { readApiJson } from './apiResponse';
import { fetchWithRetry } from './fetchRetry';

async function healthRequest(path, options = {}) {
  const apiBase = getApiUrl();
  if (!apiBase) throw new Error('Backend not configured');
  const headers = {
    'Content-Type': 'application/json',
    ...(await getApiAuthHeadersAsync()),
    ...(options.headers || {}),
  };
  const res = await fetchWithRetry(
    `${apiBase}${path}`,
    { ...options, headers, body: options.body },
    3,
    55_000
  );
  const data = await readApiJson(res);
  if (!res.ok) {
    throw new Error(data?.error?.message || `Request failed (${res.status})`);
  }
  return data;
}

export async function askNhis(question, history = []) {
  return healthRequest('/api/health/nhis', {
    method: 'POST',
    body: JSON.stringify({ question, history }),
  });
}

export async function askDiet(question, history = []) {
  return healthRequest('/api/health/diet', {
    method: 'POST',
    body: JSON.stringify({ question, history }),
  });
}

export async function scanMedicine(base64, mimeType = 'image/jpeg') {
  return healthRequest('/api/health/medicine/scan', {
    method: 'POST',
    body: JSON.stringify({ base64, mimeType }),
  });
}

export async function analyzePrescription(base64, mimeType = 'image/jpeg', caption = '') {
  return healthRequest('/api/health/prescription/analyze', {
    method: 'POST',
    body: JSON.stringify({ base64, mimeType, caption }),
  });
}

export async function logBp(payload) {
  return healthRequest('/api/health/bp', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function fetchBpLogs(limit = 30) {
  return healthRequest(`/api/health/bp?limit=${limit}`);
}

export async function fetchReminders() {
  return healthRequest('/api/health/reminders');
}

export async function createReminder(payload) {
  return healthRequest('/api/health/reminders', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function markReminderTaken(id) {
  return healthRequest(`/api/health/reminders/${id}/taken`, { method: 'POST', body: '{}' });
}

export async function snoozeReminder(id, minutes = 30) {
  return healthRequest(`/api/health/reminders/${id}/snooze`, {
    method: 'POST',
    body: JSON.stringify({ minutes }),
  });
}

export async function deleteReminder(id) {
  return healthRequest(`/api/health/reminders/${id}`, { method: 'DELETE' });
}

export async function fetchNearbyFacilities(lat, lon, type = 'pharmacy') {
  return healthRequest(`/api/health/facilities/nearby?lat=${lat}&lon=${lon}&type=${type}`);
}

export async function orderMedicineDelivery(medicationName, amountKobo = 4500) {
  return healthRequest('/api/health/delivery/order', {
    method: 'POST',
    body: JSON.stringify({ medicationName, amountKobo }),
  });
}

export async function fetchBroadcasts() {
  return healthRequest('/api/health/broadcasts');
}

export async function markBroadcastRead(id) {
  return healthRequest(`/api/health/broadcasts/${id}/read`, { method: 'POST', body: '{}' });
}

export async function fetchFamilyProfiles() {
  return healthRequest('/api/family-profiles');
}

export async function createFamilyProfile(payload) {
  return healthRequest('/api/family-profiles', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateFamilyProfile(id, payload) {
  return healthRequest(`/api/family-profiles/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteFamilyProfile(id) {
  return healthRequest(`/api/family-profiles/${id}`, { method: 'DELETE' });
}

export async function fetchPointsTransactions(limit = 50) {
  return healthRequest(`/api/points/transactions?limit=${limit}`);
}
