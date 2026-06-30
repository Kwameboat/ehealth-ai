import {
  countTriageAssistantTurns,
  isLikelyTruncatedText,
  resolveTriageDirective,
  shouldGiveRecommendations,
} from '../Config/medicalChatPrompt';
import { getApiAuthHeadersAsync } from './apiAuth';
import { getApiUrl } from './appConfig';
import { readApiJson } from './apiResponse';
import { fetchWithRetry } from './fetchRetry';
import { notifyPointsBalance } from './pointsBridge';
import { typingForIntent } from '../constants/smartAssistant';

function getApiBase() {
  return getApiUrl();
}

function buildMeta(history, recommending) {
  const triageTurn = countTriageAssistantTurns(history);
  return {
    triageTurn,
    recommending,
    phase: recommending ? 'recommendations' : triageTurn === 0 ? 'intake' : 'triage',
  };
}

const LEAK_PATTERNS = [
  /^understood\.?\s*i will ask at most/i,
  /^you are agyenim,?\s*the (professional|ehealth)/i,
  /conversation style \(strict\)/i,
  /give your final recommendations now/i,
  /internal instruction/i,
];

function sanitizeClientReply(text) {
  let t = String(text || '').trim();
  t = t.replace(/\*\*/g, '');
  for (const re of LEAK_PATTERNS) {
    if (re.test(t)) t = t.replace(re, '').trim();
  }
  t = t.replace(/\bon whatsapp\b/gi, 'in this app');
  t = t.replace(/\buse whatsapp\b/gi, 'use this app');
  t = t.replace(/\bregister at ehealthaigh\.com\b/gi, 'sign in to this app');
  t = t.replace(/\bvisit ehealthaigh\.com\b/gi, 'use this app');
  return t.trim();
}

/**
 * @returns {Promise<{ reply: string, meta?: object, actions?: array }>}
 */
export async function sendChatMessage({
  history = [],
  userText = '',
  attachment = null,
  attachments = null,
  onPointsUpdate,
}) {
  const apiBase = getApiBase();
  const fileList =
    attachments?.length > 0
      ? attachments
      : attachment?.base64
        ? [attachment]
        : [];

  if (apiBase) {
    const response = await fetchWithRetry(`${apiBase}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(await getApiAuthHeadersAsync()),
      },
      body: JSON.stringify({
        history,
        userText,
        attachment: fileList[0] || null,
        attachments: fileList.length ? fileList : null,
      }),
    }, 4);
    const data = await readApiJson(response);
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
    return {
      reply: sanitizeClientReply(data.reply),
      meta: data.meta,
      actions: data.actions || [],
    };
  }

  throw new Error('Assistant is unavailable. Sign in and ensure the server is running.');
}

export function getTypingLabel(history, hasAttachments = false, intent = null) {
  const smart = typingForIntent(intent, history, hasAttachments);
  if (smart) return smart;
  if (hasAttachments) return 'Reviewing your files…';
  const triageTurn = countTriageAssistantTurns(history);
  if (shouldGiveRecommendations(history)) return 'Preparing your recommendations…';
  if (triageTurn === 0) return 'Understanding your question…';
  if (triageTurn >= 3) return 'Almost there…';
  return 'Thinking…';
}
