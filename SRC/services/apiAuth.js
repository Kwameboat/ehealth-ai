import { getStoredToken } from './authStorage';
import { getAppApiSecret } from './appConfig';

/** App bundle secret — from /app-config.js (production) or build-time env. */
export function getApiAuthHeaders() {
  const secret = getAppApiSecret();
  const headers = {};
  if (secret) {
    headers['X-MedAssistant-Key'] = secret;
  }
  return headers;
}

/** App secret + user session for protected API routes. */
export async function getApiAuthHeadersAsync() {
  const headers = getApiAuthHeaders();
  const token = await getStoredToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}
