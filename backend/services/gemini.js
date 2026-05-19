const { getGeminiApiKey, getGeminiModel } = require('./settings');
const { normalizeGeminiModel } = require('./geminiModels');
const {
  MEDICAL_CHAT_SYSTEM_PROMPT,
  MEDICAL_CHAT_MODEL_ACK,
  MEDICAL_CHAT_GENERATION_CONFIG,
} = require('./medicalChatPrompt');

async function callGemini(contents, model, options = {}) {
  const apiKey = getGeminiApiKey();
  const useModel = normalizeGeminiModel(model || getGeminiModel());

  if (!apiKey) {
    const err = new Error('Gemini API key is not configured. Add it in Admin → Settings & Keys.');
    err.status = 500;
    throw err;
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${useModel}:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      ...(options.generationConfig ? { generationConfig: options.generationConfig } : {}),
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    const message = data?.error?.message || `Gemini request failed (${response.status})`;
    const err = new Error(message);
    err.status = response.status;
    throw err;
  }
  return data;
}

function normalizeBase64(data) {
  if (!data || typeof data !== 'string') return '';
  const trimmed = data.replace(/\s/g, '');
  return trimmed.includes(',') ? trimmed.split(',').pop() : trimmed;
}

function buildChatContents(history, userText, attachment) {
  const userParts = [];
  const b64 = normalizeBase64(attachment?.base64);
  if (b64 && attachment?.mimeType) {
    userParts.push({
      inline_data: { mime_type: attachment.mimeType, data: b64 },
    });
  }
  const trimmed = (userText || '').trim();
  if (trimmed) userParts.push({ text: trimmed });
  if (userParts.length === 0) {
    userParts.push({ text: 'Please analyze the attached file and summarize any medical information.' });
  }

  const recentHistory = history.slice(-14).map((msg) => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.text || '(shared an attachment)' }],
  }));

  return [
    { role: 'user', parts: [{ text: MEDICAL_CHAT_SYSTEM_PROMPT }] },
    { role: 'model', parts: [{ text: MEDICAL_CHAT_MODEL_ACK }] },
    ...recentHistory,
    { role: 'user', parts: userParts },
  ];
}

function resolveChatFeatureKey(attachment) {
  if (!attachment?.mimeType) return 'chat_text';
  if (attachment.mimeType === 'application/pdf') return 'chat_pdf';
  if (attachment.mimeType.startsWith('image/')) return 'chat_image';
  return 'chat_text';
}

async function chatCompletion(history, userText, attachment) {
  const contents = buildChatContents(history, userText, attachment);
  const data = await callGemini(contents, undefined, {
    generationConfig: MEDICAL_CHAT_GENERATION_CONFIG,
  });
  const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!reply) throw new Error('No response from the assistant');
  return reply;
}

module.exports = {
  callGemini,
  chatCompletion,
  buildChatContents,
  resolveChatFeatureKey,
  MEDICAL_CHAT_SYSTEM_PROMPT,
};
