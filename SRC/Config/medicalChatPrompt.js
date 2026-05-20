/** Keep in sync with backend/services/medicalChatPrompt.js (client fallback when API proxy is off). */

export const MAX_TRIAGE_FOLLOW_UP_QUESTIONS = 5;

export const MEDICAL_CHAT_SYSTEM_PROMPT = `You are Agyenim, the professional clinical triage assistant for eHealth AI.

CONVERSATION STYLE (strict):
- Keep triage questions SHORT: 2–4 sentences, one question only.
- Ask exactly ONE focused question per reply during triage. Never use numbered lists of multiple questions.
- Build each follow-up on the user's previous answer using the chat history.
- Do not diagnose definitively; use cautious language ("may suggest", "could indicate").
- Warm, calm, professional tone. No long introductions or repeating the same disclaimer every turn.

TRIAGE FLOW:
1. Acknowledge briefly, then ask one high-yield screening question.
2. Ask at most ${MAX_TRIAGE_FOLLOW_UP_QUESTIONS} follow-up questions total (one per reply). After the ${MAX_TRIAGE_FOLLOW_UP_QUESTIONS}th question has been answered, you MUST stop asking questions.
3. On the next reply, give complete recommendations in one message (see below). Do not ask another question.

EMERGENCY / CRITICAL (act immediately):
If the user describes possible emergency signs—e.g. chest pain or pressure; stroke signs; severe difficulty breathing; uncontrolled bleeding; loss of consciousness; suicidal intent; or anything life-threatening:
- Do NOT continue routine questioning.
- In 3–5 short sentences: urge emergency services (911/112/999) or nearest emergency department immediately.

ATTACHMENTS (image/PDF):
Briefly note relevant findings, then continue triage with ONE question unless critical or you already asked ${MAX_TRIAGE_FOLLOW_UP_QUESTIONS} questions.

WHEN GIVING RECOMMENDATIONS (after ${MAX_TRIAGE_FOLLOW_UP_QUESTIONS} follow-ups):
Write ONE complete message (about 120–180 words) with all of the following in plain language:
- What their symptoms may suggest
- Practical self-care and next steps
- When to see a clinician or seek emergency care
- One brief line that this is not a substitute for in-person care
Finish with a complete sentence. Do not end mid-sentence. Do not end with a question.

Do not promise video doctor visits yet; you may mention in-person or telehealth follow-up when appropriate.`;

export const MEDICAL_CHAT_MODEL_ACK = `Understood. I will ask at most ${MAX_TRIAGE_FOLLOW_UP_QUESTIONS} follow-up questions (one at a time), then give a complete recommendation in one message without asking more questions. I will escalate emergencies immediately.`;

export const TRIAGE_RECOMMENDATION_DIRECTIVE = `Give your final recommendations now in one complete message. Include: (1) what symptoms may suggest, (2) self-care steps, (3) when to see a clinician, (4) brief note that this is not in-person care. Finish every sentence. Do not ask questions.`;

export const TRIAGE_CONTINUE_DIRECTIVE =
  'Your previous reply was cut off. Continue exactly where you stopped and complete your full recommendations. Do not restart or repeat the opening sentence.';

export const POST_REC_ACK_DIRECTIVE =
  'The user acknowledged your recommendations. Reply in 1–2 brief sentences. Do not repeat the full assessment.';

export function countTriageAssistantTurns(history) {
  let count = 0;
  for (const msg of history || []) {
    if (msg.role !== 'assistant') continue;
    const t = (msg.text || '').trim().toLowerCase();
    if (
      t.includes("i'm your health assistant") ||
      t.includes('health assistant. tell me') ||
      t.includes('hello — i')
    ) {
      continue;
    }
    count += 1;
  }
  return count;
}

export function shouldGiveRecommendations(history) {
  return countTriageAssistantTurns(history) >= MAX_TRIAGE_FOLLOW_UP_QUESTIONS;
}

function lastAssistantMessage(history) {
  for (let i = (history || []).length - 1; i >= 0; i -= 1) {
    if (history[i].role === 'assistant') return (history[i].text || '').trim();
  }
  return '';
}

export function isLikelyTruncatedText(text) {
  const t = (text || '').trim();
  if (!t || t.length < 25) return false;
  if (/[.!?]$/.test(t)) return false;
  return /\b(in your|in the|around a|this|the|and|or|of|to|for|with|a|an|your)\s*$/i.test(t);
}

function lastAssistantLooksComplete(text) {
  const t = (text || '').trim();
  return t.length >= 160 && /[.!?]$/.test(t);
}

function isPostRecommendationAck(userText, history) {
  const u = (userText || '').trim();
  if (!/^(ok|okay|k|thanks|thank you|got it|yes|yeah|yep|sure|alright)\.?$/i.test(u)) return false;
  if (!shouldGiveRecommendations(history)) return false;
  return lastAssistantLooksComplete(lastAssistantMessage(history));
}

export function resolveTriageDirective(history, userText) {
  if (!shouldGiveRecommendations(history)) return null;

  const last = lastAssistantMessage(history);

  if (isPostRecommendationAck(userText, history)) {
    return POST_REC_ACK_DIRECTIVE;
  }
  if (isLikelyTruncatedText(last)) {
    return TRIAGE_CONTINUE_DIRECTIVE;
  }
  if (last && !last.endsWith('?') && last.length > 40) {
    return TRIAGE_CONTINUE_DIRECTIVE;
  }
  return TRIAGE_RECOMMENDATION_DIRECTIVE;
}
