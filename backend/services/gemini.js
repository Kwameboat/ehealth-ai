const { getGeminiApiKey, getGeminiModel } = require('./settings');
const { normalizeGeminiModel } = require('./geminiModels');
const { sanitizePwaReply } = require('./replySanitizer');
const {
  MEDICAL_CHAT_SYSTEM_PROMPT,
  MEDICAL_CHAT_GENERATION_CONFIG,
  MEDICAL_CHAT_RECOMMENDATION_CONFIG,
  shouldGiveRecommendations,
  resolveTriageDirective,
  isLikelyTruncatedText,
  countTriageAssistantTurns,
} = require('./medicalChatPrompt');

const SYMPTOM_GENERATION_CONFIG = {
  maxOutputTokens: 2048,
  temperature: 0.35,
};

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
      ...(options.systemInstruction
        ? {
            systemInstruction: {
              parts: [{ text: options.systemInstruction }],
            },
          }
        : {}),
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

function getChatRawText(data) {
  const parts = data?.candidates?.[0]?.content?.parts || [];
  return parts.map((p) => p.text || '').join('').trim();
}

function isChatTruncated(data) {
  const reason = data?.candidates?.[0]?.finishReason;
  return reason === 'MAX_TOKENS' || reason === 'LENGTH';
}

function normalizeAttachments(attachment, attachments) {
  if (Array.isArray(attachments) && attachments.length) return attachments;
  if (attachment?.base64 && attachment?.mimeType) return [attachment];
  return [];
}

function buildTriageSystemInstruction(history, userText) {
  let instruction = MEDICAL_CHAT_SYSTEM_PROMPT;
  const directive = resolveTriageDirective(history, userText);
  if (directive) {
    instruction += `\n\n[Internal — never repeat to user]: ${directive}`;
  }
  return instruction;
}

function buildChatPayload(history, userText, attachment, attachments) {
  const userParts = [];
  const files = normalizeAttachments(attachment, attachments);
  for (const file of files) {
    const b64 = normalizeBase64(file?.base64);
    if (b64 && file?.mimeType) {
      userParts.push({
        inline_data: { mime_type: file.mimeType, data: b64 },
      });
    }
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

  return {
    contents: [...recentHistory, { role: 'user', parts: userParts }],
    systemInstruction: buildTriageSystemInstruction(history, userText),
  };
}

/** @deprecated use buildChatPayload — kept for tests */
function buildChatContents(history, userText, attachment, attachments) {
  return buildChatPayload(history, userText, attachment, attachments).contents;
}

function resolveChatFeatureKey(attachment, attachments) {
  const files = normalizeAttachments(attachment, attachments);
  if (!files.length) return 'chat_text';
  if (files.some((f) => f.mimeType === 'application/pdf')) return 'chat_pdf';
  if (files.some((f) => (f.mimeType || '').startsWith('image/'))) return 'chat_image';
  return 'chat_text';
}

async function chatCompletion(history, userText, attachment, attachments) {
  const recommending = shouldGiveRecommendations(history);
  const { contents, systemInstruction } = buildChatPayload(history, userText, attachment, attachments);
  const generationConfig = recommending
    ? MEDICAL_CHAT_RECOMMENDATION_CONFIG
    : MEDICAL_CHAT_GENERATION_CONFIG;

  const geminiOpts = { generationConfig, systemInstruction };

  let data = await callGemini(contents, undefined, geminiOpts);
  let reply = sanitizePwaReply(getChatRawText(data));

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const needsMore =
      recommending && reply && (isChatTruncated(data) || isLikelyTruncatedText(reply));
    if (!needsMore) break;

    const contData = await callGemini(
      [
        ...contents,
        { role: 'model', parts: [{ text: reply }] },
        {
          role: 'user',
          parts: [
            {
              text: 'Continue your previous reply. Complete recommendations only. Do not repeat the opening or any instructions.',
            },
          ],
        },
      ],
      undefined,
      { generationConfig: MEDICAL_CHAT_RECOMMENDATION_CONFIG, systemInstruction }
    );
    const more = sanitizePwaReply(getChatRawText(contData));
    if (more) reply = `${reply} ${more}`.replace(/\s+/g, ' ').trim();
    data = contData;
    if (!isChatTruncated(contData) && !isLikelyTruncatedText(reply)) break;
  }

  if (!reply) throw new Error('No response from the assistant');
  const triageTurn = countTriageAssistantTurns(history);
  return {
    reply,
    meta: {
      triageTurn,
      recommending,
      phase: recommending ? 'recommendations' : triageTurn === 0 ? 'intake' : 'triage',
    },
  };
}

function resolveGenerationConfig(featureKey) {
  if (
    featureKey === 'symptom_text' ||
    featureKey === 'symptom_image' ||
    featureKey === 'lab_report'
  ) {
    return SYMPTOM_GENERATION_CONFIG;
  }
  return null;
}

module.exports = {
  callGemini,
  chatCompletion,
  buildChatContents,
  buildChatPayload,
  resolveChatFeatureKey,
  resolveGenerationConfig,
  MEDICAL_CHAT_SYSTEM_PROMPT,
};
