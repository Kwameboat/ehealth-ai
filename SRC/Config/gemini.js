/** Gemini keys stay server-side when using the API proxy. */
export const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '';

export const GEMINI_MODEL = 'gemini-2.0-flash';

export const GEMINI_API_URL = GEMINI_API_KEY
  ? `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`
  : '';

export const MEDICAL_CHAT_SYSTEM_PROMPT =
  'You are a careful medical health assistant. Provide clear, practical guidance. ' +
  'Do not diagnose definitively. Mention when to seek professional care. ' +
  'When the user shares an image or PDF (lab report, prescription, scan, etc.), analyze it carefully and explain findings in plain language.';
