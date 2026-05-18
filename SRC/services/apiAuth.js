import { getStoredToken } from './authStorage';

/** App bundle secret — not shown in UI. */
export function getApiAuthHeaders() {
  const secret = process.env.EXPO_PUBLIC_APP_API_SECRET;
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
