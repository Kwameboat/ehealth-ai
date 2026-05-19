/** Default Gemini model IDs (Google Generative Language API). */
const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
const DEFAULT_GEMINI_PRO_MODEL = 'gemini-2.5-pro';

const DEPRECATED = new Set([
  'gemini-2.0-flash',
  'gemini-pro',
  'models/gemini-2.0-flash',
  'models/gemini-pro',
]);

function normalizeGeminiModel(model, fallback = DEFAULT_GEMINI_MODEL) {
  if (!model || typeof model !== 'string') return fallback;
  const id = model.trim().replace(/^models\//, '');
  if (!id) return fallback;
  if (DEPRECATED.has(id) || DEPRECATED.has(`models/${id}`)) return fallback;
  return id;
}

module.exports = {
  DEFAULT_GEMINI_MODEL,
  DEFAULT_GEMINI_PRO_MODEL,
  normalizeGeminiModel,
};
