/** Gemini keys stay server-side when using the API proxy. */
export const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '';

export const GEMINI_MODEL = 'gemini-2.5-flash';

export const GEMINI_API_URL = GEMINI_API_KEY
  ? `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`
  : '';

export {
  MEDICAL_CHAT_SYSTEM_PROMPT,
  MEDICAL_CHAT_MODEL_ACK,
} from './medicalChatPrompt';
