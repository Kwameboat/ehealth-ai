import { getApiAuthHeadersAsync } from './apiAuth';
import { getApiUrl } from './appConfig';

async function consultRequest(path, options = {}) {
  const apiBase = getApiUrl();
  if (!apiBase) throw new Error('Backend not configured');
  const headers = {
    'Content-Type': 'application/json',
    ...(await getApiAuthHeadersAsync()),
    ...(options.headers || {}),
  };
  const res = await fetch(`${apiBase}${path}`, { ...options, headers, body: options.body });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || 'Request failed');
  return data;
}

export async function fetchDoctors() {
  return consultRequest('/api/doctors');
}

export async function fetchDoctor(id) {
  return consultRequest(`/api/doctors/${id}`);
}

export async function fetchDoctorSlots(id, date) {
  const q = date ? `?date=${encodeURIComponent(date)}` : '';
  return consultRequest(`/api/doctors/${id}/slots${q}`);
}

export async function bookConsultation({ doctorId, scheduledAt, chiefComplaint }) {
  return consultRequest('/api/consultations/book', {
    method: 'POST',
    body: JSON.stringify({ doctorId, scheduledAt, chiefComplaint }),
  });
}

export async function fetchMyConsultations() {
  return consultRequest('/api/consultations/mine');
}

export async function cancelConsultation(id) {
  return consultRequest(`/api/consultations/${id}/cancel`, { method: 'POST', body: '{}' });
}
