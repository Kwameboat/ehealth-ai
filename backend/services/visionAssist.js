const { getGeminiApiKey } = require('./settings');
const { callGemini } = require('./gemini');

const VISION_MODEL = 'gemini-2.0-flash';

function normalizeBase64(data) {
  if (!data || typeof data !== 'string') return '';
  const trimmed = data.replace(/\s/g, '');
  return trimmed.includes(',') ? trimmed.split(',').pop() : trimmed;
}

function parseJsonBlock(text) {
  const match = String(text || '').match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

async function analyzeMedicineImage(base64, mimeType = 'image/jpeg') {
  const b64 = normalizeBase64(base64);
  if (!b64) throw new Error('Image data required');
  if (!getGeminiApiKey()) throw new Error('Gemini API key not configured');

  const prompt = `Analyze this medicine/packaging image for a Ghana health app.
Return ONLY valid JSON (no markdown):
{
  "name": "medicine name or best guess",
  "type": "drug class e.g. Antibiotic, Antihypertensive",
  "uses": "common uses in plain language",
  "dosage": "typical adult dosing if visible on label, else general guidance",
  "sideEffects": "common side effects",
  "warnings": "key safety warnings including Ghana context if relevant",
  "confidence": number 0-100
}
If unclear, still return JSON with lower confidence and explain in warnings.`;

  const data = await callGemini(
    [
      { role: 'user', parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: b64 } }] },
    ],
    VISION_MODEL
  );
  const raw = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
  const parsed = parseJsonBlock(raw);
  if (parsed?.name) {
    return {
      name: String(parsed.name),
      type: String(parsed.type || 'Medicine'),
      uses: String(parsed.uses || ''),
      dosage: String(parsed.dosage || ''),
      sideEffects: String(parsed.sideEffects || ''),
      warnings: String(parsed.warnings || ''),
      confidence: Number(parsed.confidence) || 70,
      summary: raw.trim(),
    };
  }
  return {
    name: 'Unknown medicine',
    type: 'Medicine',
    uses: raw.trim() || 'Could not identify clearly.',
    dosage: '',
    sideEffects: '',
    warnings: 'Confirm with a pharmacist before use.',
    confidence: 40,
    summary: raw.trim(),
  };
}

async function analyzePrescriptionImage(base64, mimeType = 'image/jpeg', caption = '') {
  const b64 = normalizeBase64(base64);
  if (!b64) throw new Error('Image data required');
  if (!getGeminiApiKey()) throw new Error('Gemini API key not configured');

  const prompt = `Analyze this medicine/prescription image for a Ghana health app.
Return ONLY valid JSON (no markdown):
{
  "isPrescription": boolean,
  "isLabReport": boolean,
  "medicationName": "string or null",
  "dosageInstructions": "plain language e.g. Take 1 tablet twice daily for 7 days",
  "suggestedTimes": ["08:00","20:00"],
  "durationDays": number,
  "deliveryMedications": ["medicine names if OTC delivery makes sense"],
  "summary": "short user-facing summary"
}
${caption ? `Caption: ${caption}` : ''}`;

  const data = await callGemini(
    [
      { role: 'user', parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: b64 } }] },
    ],
    VISION_MODEL
  );
  const raw = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
  const parsed = parseJsonBlock(raw) || {};
  return {
    isPrescription: !!parsed.isPrescription,
    isLabReport: !!parsed.isLabReport,
    medicationName: parsed.medicationName ? String(parsed.medicationName) : null,
    dosageInstructions: parsed.dosageInstructions ? String(parsed.dosageInstructions) : null,
    suggestedTimes: Array.isArray(parsed.suggestedTimes) ? parsed.suggestedTimes.map(String) : ['08:00', '20:00'],
    durationDays: Number(parsed.durationDays) || 7,
    deliveryMedications: Array.isArray(parsed.deliveryMedications)
      ? parsed.deliveryMedications.map(String)
      : [],
    summary: String(parsed.summary || raw.trim() || 'Analysis complete.'),
  };
}

module.exports = { analyzeMedicineImage, analyzePrescriptionImage };
