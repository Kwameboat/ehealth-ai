const { getGeminiApiKey } = require('./settings');
const { callGemini } = require('./gemini');

const NHIS_PROMPT = `You are Agyenim, an NHIS (National Health Insurance Scheme) assistant for Ghana.
Explain typical NHIS coverage in plain language: outpatient visits, selected medications, maternity, child welfare, and that some drugs/procedures may need co-payment or are excluded.
Always say users should confirm at their registered NHIS facility. Never guarantee coverage for a specific drug without caveat.
Keep answers under 180 words unless listing items.`;

const DIET_PROMPT = `You are Agyenim, a Ghana-focused nutrition coach for hypertension and Type 2 diabetes.
Give culturally accurate advice about Ghanaian foods: fufu, banku, rice, yam, plantain, kontomire, light soup, palm nut soup, waakye, kelewele, etc.
Suggest practical swaps (boiled plantain, smaller fufu portions, more kontomire/vegetables, less sugary drinks).
Include a brief post-meal tip (e.g. 15-minute walk). Not a doctor — encourage clinic follow-up for medication changes.`;

async function specialtyAnswer(systemPrompt, question) {
  const apiKey = getGeminiApiKey();
  if (!apiKey) throw new Error('Gemini API key not configured');
  const data = await callGemini(
    [{ role: 'user', parts: [{ text: String(question).trim() }] }],
    undefined,
    { systemInstruction: systemPrompt }
  );
  const text =
    data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ||
    data?.text ||
    'Sorry, I could not generate a response.';
  return text.trim();
}

async function answerNhisQuestion(question) {
  return specialtyAnswer(NHIS_PROMPT, question);
}

async function answerDietQuestion(question) {
  return specialtyAnswer(DIET_PROMPT, question);
}

function parseBloodPressure(text) {
  const m = String(text).match(/(\d{2,3})\s*\/\s*(\d{2,3})/);
  if (!m) return null;
  const systolic = parseInt(m[1], 10);
  const diastolic = parseInt(m[2], 10);
  if (systolic < 50 || systolic > 300 || diastolic < 30 || diastolic > 200) return null;
  return { systolic, diastolic, valueText: `${systolic}/${diastolic}` };
}

function bpInterpretation(systolic, diastolic) {
  if (systolic >= 140 || diastolic >= 90) {
    return 'Your reading looks elevated. Rest 5 minutes and recheck, or contact your clinic if persistent.';
  }
  if (systolic < 90 || diastolic < 60) {
    return 'Reading looks low. Stay hydrated and seek care if you feel dizzy.';
  }
  return 'Reading looks within a normal range. Keep logging weekly!';
}

module.exports = {
  answerNhisQuestion,
  answerDietQuestion,
  parseBloodPressure,
  bpInterpretation,
};
