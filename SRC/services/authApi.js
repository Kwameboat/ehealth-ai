import { getApiAuthHeaders, getApiAuthHeadersAsync } from './apiAuth';

function getApiBase() {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin.replace(/\/$/, '');
  }
  return null;
}

export function isBackendConfigured() {
  return !!getApiBase() && !!process.env.EXPO_PUBLIC_APP_API_SECRET;
}

async function request(path, options = {}) {
  const apiBase = getApiBase();
  if (!apiBase) throw new Error('Backend not configured');

  const authHeaders = options.useUserAuth ? await getApiAuthHeadersAsync() : getApiAuthHeaders();

  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...(options.headers || {}),
    },
    body: options.body,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(data?.error?.message || 'Request failed');
    err.code = data?.error?.code;
    err.status = response.status;
    throw err;
  }
  return data;
}

export async function registerUser({ email, password, fullName }) {
  return request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, fullName }),
  });
}

export async function loginUser({ email, password }) {
  return request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function fetchMe() {
  return request('/api/me', {
    method: 'GET',
    useUserAuth: true,
  });
}
