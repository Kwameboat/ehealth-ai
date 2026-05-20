import { getApiAuthHeaders, getApiAuthHeadersAsync } from './apiAuth';
import { getApiUrl, getAppApiSecret } from './appConfig';

function getApiBase() {
  return getApiUrl();
}

export function isBackendConfigured() {
  return !!getApiBase() && !!getAppApiSecret();
}

async function request(path, options = {}) {
  const apiBase = getApiBase();
  if (!apiBase) throw new Error('Backend not configured');

  const authHeaders = options.useUserAuth ? await getApiAuthHeadersAsync() : getApiAuthHeaders();

  let response;
  try {
    response = await fetch(`${apiBase}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
        ...(options.headers || {}),
      },
      body: options.body,
    });
  } catch (err) {
    if (!getAppApiSecret()) {
      throw new Error(
        'App API key missing. Redeploy the site or ask admin to set APP_API_SECRET in cPanel and restart Node.'
      );
    }
    throw new Error(
      `Cannot reach API at ${apiBase}. Check /api/health in the browser, then restart the Node app in cPanel.`
    );
  }

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

export async function updateMe({ fullName, email, password, currentPassword }) {
  return request('/api/me', {
    method: 'PATCH',
    useUserAuth: true,
    body: JSON.stringify({ fullName, email, password, currentPassword }),
  });
}

export async function deleteMe({ password }) {
  return request('/api/me', {
    method: 'DELETE',
    useUserAuth: true,
    body: JSON.stringify({ password }),
  });
}
