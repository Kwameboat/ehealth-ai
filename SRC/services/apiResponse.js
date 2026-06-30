/**
 * Parse API responses safely — avoids "Unexpected token '<'" when the server returns HTML error pages.
 */
export async function readApiJson(res) {
  const contentType = (res.headers.get('content-type') || '').toLowerCase();
  const text = await res.text();
  const trimmed = text.trim();

  if (!trimmed) {
    if (!res.ok) {
      throw new Error(`Request failed (${res.status})`);
    }
    return {};
  }

  const looksJson =
    contentType.includes('application/json') ||
    trimmed.startsWith('{') ||
    trimmed.startsWith('[');

  if (looksJson) {
    try {
      return JSON.parse(trimmed);
    } catch {
      throw new Error(`Invalid server response (${res.status})`);
    }
  }

  if (trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html')) {
    if (res.status === 503 || res.status === 502 || res.status === 504) {
      throw new Error(
        'Server is busy — wait a few seconds and try again. If this continues, RESTART Node.js in cPanel.'
      );
    }
    throw new Error(
      `Server returned an error page (${res.status}). Open /api/health in your browser to check the API.`
    );
  }

  throw new Error(`Unexpected server response (${res.status})`);
}
