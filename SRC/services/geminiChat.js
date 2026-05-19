import {
  MEDICAL_CHAT_MODEL_ACK,
  MEDICAL_CHAT_SYSTEM_PROMPT,
  isLikelyTruncatedText,
  resolveTriageDirective,
  shouldGiveRecommendations,
} from '../Config/medicalChatPrompt';
import { getApiAuthHeadersAsync } from './apiAuth';
import { getApiUrl } from './appConfig';
import { notifyPointsBalance } from './pointsBridge';

function getApiBase() {
  return getApiUrl();
}

/**
 * @param {object} params
 * @param {Array<{role: 'user'|'assistant', text: string}>} params.history
 * @param {string} [params.userText]
 * @param {{ mimeType: string, base64: string } | null} [params.attachment]
 * @param {(balance: number) => void} [params.onPointsUpdate]
 * @returns {Promise<string>} reply text
 */
export async function sendChatMessage({ history = [], userText = '', attachment = null, onPointsUpdate }) {
  const apiBase = getApiBase();

  if (apiBase) {
    const response = await fetch(`${apiBase}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(await getApiAuthHeadersAsync()),
      },
      body: JSON.stringify({ history, userText, attachment }),
    });
    const data = await response.json();
    if (!response.ok) {
      const err = new Error(data?.error?.message || 'Unable to reach the assistant');
      err.code = data?.error?.code;
      err.status = response.status;
      throw err;
    }
    if (!data.reply) {
      throw new Error('No response from the assistant');
    }
    if (data.points?.balance != null) {
      notifyPointsBalance(data.points.balance);
      if (onPointsUpdate) onPointsUpdate(data.points.balance);
    }
    return data.reply;
  }

  const { generateContent } = await import('./geminiClient');

  const userParts = [];
  if (attachment?.base64 && attachment?.mimeType) {
    userParts.push({
      inline_data: { mime_type: attachment.mimeType, data: attachment.base64 },
    });
  }
  const trimmedText = (userText || '').trim();
  if (trimmedText) userParts.push({ text: trimmedText });
  if (userParts.length === 0) {
    userParts.push({ text: 'Please analyze the attached file and summarize any medical information.' });
  }

  const triageDirective = resolveTriageDirective(history, userText);
  if (triageDirective) {
    userParts.push({ text: triageDirective });
  }

  const recentHistory = history.slice(-14).map((msg) => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.text || '(shared an attachment)' }],
  }));

  const contents = [
    { role: 'user', parts: [{ text: MEDICAL_CHAT_SYSTEM_PROMPT }] },
    { role: 'model', parts: [{ text: MEDICAL_CHAT_MODEL_ACK }] },
    ...recentHistory,
    { role: 'user', parts: userParts },
  ];

  const recommending = shouldGiveRecommendations(history);
  let data = await generateContent({ contents });
  let reply =
    data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('').trim() || '';

  const isTruncated = () => {
    const reason = data?.candidates?.[0]?.finishReason;
    return reason === 'MAX_TOKENS' || reason === 'LENGTH';
  };

  for (
    let attempt = 0;
    attempt < 2 && recommending && reply && (isTruncated() || isLikelyTruncatedText(reply));
    attempt += 1
  ) {
    const contData = await generateContent({
      contents: [
        ...contents,
        { role: 'model', parts: [{ text: reply }] },
        {
          role: 'user',
          parts: [
            {
              text: 'Continue exactly where you were cut off. Complete your recommendations. Do not repeat the opening.',
            },
          ],
        },
      ],
    });
    const more =
      contData?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('').trim() || '';
    if (more) reply = `${reply} ${more}`.replace(/\s+/g, ' ').trim();
    data = contData;
  }

  if (!reply) {
    throw new Error('No response from the assistant');
  }
  return reply;
}
