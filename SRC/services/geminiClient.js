import { GEMINI_API_KEY, GEMINI_MODEL } from '../Config/gemini';
import { getApiAuthHeadersAsync } from './apiAuth';
import { getApiUrl } from './appConfig';
import { notifyPointsBalance } from './pointsBridge';

export const GEMINI_MODEL_FLASH = 'gemini-2.0-flash';
export const GEMINI_MODEL_PRO = 'gemini-pro';

function getApiBaseUrl() {
  return getApiUrl();
}

function resolveFeatureKey(contents, override) {
  if (override) return override;
  const hasImage = (contents || []).some((c) =>
    (c.parts || []).some((p) => p.inline_data)
  );
  return hasImage ? 'symptom_image' : 'symptom_text';
}

async function postToBackend(path, body) {
  const apiBase = getApiBaseUrl();
  if (!apiBase) return null;

  const response = await fetch(`${apiBase}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(await getApiAuthHeadersAsync()),
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  if (!response.ok) {
    const err = new Error(data?.error?.message || 'Unable to reach the assistant');
    err.code = data?.error?.code;
    err.status = response.status;
    throw err;
  }
  return data;
}

/**
 * @param {{ contents: object[] }} payload
 * @param {{ model?: string, featureKey?: string, onPointsUpdate?: (balance: number) => void }} [options]
 */
export async function generateContent(payload, options = {}) {
  const { contents } = payload;
  const model = options.model || GEMINI_MODEL;
  const featureKey = resolveFeatureKey(contents, options.featureKey);

  const data = await postToBackend('/api/gemini/generateContent', {
    contents,
    model,
    featureKey,
  });
  if (data) {
    if (data.points?.balance != null) {
      notifyPointsBalance(data.points.balance);
      if (options.onPointsUpdate) options.onPointsUpdate(data.points.balance);
    }
    return data;
  }

  if (!GEMINI_API_KEY) {
    throw new Error('Assistant is temporarily unavailable. Please sign in when the server is running.');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents }),
  });
  const direct = await response.json();
  if (!response.ok) {
    throw new Error(direct?.error?.message || 'Assistant request failed');
  }
  return direct;
}
