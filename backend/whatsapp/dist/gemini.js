"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VISION_MODEL = exports.TEXT_MODEL = void 0;
exports.analyzeText = analyzeText;
exports.analyzeAudio = analyzeAudio;
exports.analyzeLabOrMedicineImage = analyzeLabOrMedicineImage;
exports.extractPrescriptionFromImage = extractPrescriptionFromImage;
exports.analyzeWithSpecialtyPrompt = analyzeWithSpecialtyPrompt;
const { postJson } = require('../../services/httpsJson');
const TEXT_MODEL = 'gemini-2.5-flash';
exports.TEXT_MODEL = TEXT_MODEL;
const VISION_MODEL = 'gemini-2.5-pro';
exports.VISION_MODEL = VISION_MODEL;
function extractText(data) {
    const parts = data?.candidates?.[0]?.content?.parts || [];
    return parts.map((p) => p.text || '').join('').trim();
}
async function geminiGenerate(apiKey, model, parts) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const { status, data } = await postJson(url, {
        contents: [{ role: 'user', parts }],
    }, 22_000);
    if (status < 200 || status >= 300) {
        throw new Error(data?.error?.message || `Gemini request failed (${status})`);
    }
    return extractText(data);
}
async function analyzeText(apiKey, systemPrompt, userText, history = []) {
    const context = history.length > 0
        ? `Recent conversation:\n${history.slice(-6).join('\n')}\n\nUser: ${userText}`
        : userText;
    const reply = await geminiGenerate(apiKey, TEXT_MODEL, [
        { text: `${systemPrompt}\n\n${context}` },
    ]);
    return reply || 'I could not generate a response. Please try again.';
}
async function analyzeAudio(apiKey, systemPrompt, base64, mimeType) {
    const reply = await geminiGenerate(apiKey, TEXT_MODEL, [
        { text: `${systemPrompt}\n\nListen to this voice note and respond helpfully in plain language.` },
        { inline_data: { mime_type: mimeType || 'audio/ogg', data: base64 } },
    ]);
    return reply || 'I could not process the voice note. Please try again or send text.';
}
async function analyzeLabOrMedicineImage(apiKey, systemPrompt, base64, mimeType, caption) {
    const prompt = `${systemPrompt}

Analyze this image. If it looks like a lab report, summarize key values and flag anything that may need clinician review. If it looks like medicine packaging, identify the medicine name, common uses, and general safety reminders. If unclear, say what you see and ask for a clearer photo.
${caption ? `\nUser caption: ${caption}` : ''}`;
    const reply = await geminiGenerate(apiKey, VISION_MODEL, [
        { text: prompt },
        { inline_data: { mime_type: mimeType || 'image/jpeg', data: base64 } },
    ]);
    return reply || 'I could not analyze the image. Please send a clearer photo.';
}
function parseJsonBlock(text) {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match)
        return null;
    try {
        return JSON.parse(match[0]);
    }
    catch {
        return null;
    }
}
async function extractPrescriptionFromImage(apiKey, base64, mimeType, caption) {
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
    const raw = await geminiGenerate(apiKey, VISION_MODEL, [
        { text: prompt },
        { inline_data: { mime_type: mimeType || 'image/jpeg', data: base64 } },
    ]);
    const json = parseJsonBlock(raw) || {};
    return {
        isPrescription: !!json.isPrescription,
        isLabReport: !!json.isLabReport,
        medicationName: json.medicationName ? String(json.medicationName) : undefined,
        dosageInstructions: json.dosageInstructions ? String(json.dosageInstructions) : undefined,
        suggestedTimes: Array.isArray(json.suggestedTimes) ? json.suggestedTimes.map(String) : ['08:00', '20:00'],
        durationDays: json.durationDays ? Number(json.durationDays) : 7,
        deliveryMedications: Array.isArray(json.deliveryMedications) ? json.deliveryMedications.map(String) : [],
        summary: json.summary ? String(json.summary) : raw.slice(0, 400),
    };
}
async function analyzeWithSpecialtyPrompt(apiKey, specialtyPrompt, userText) {
    const reply = await geminiGenerate(apiKey, TEXT_MODEL, [{ text: `${specialtyPrompt}\n\nUser: ${userText}` }]);
    return reply || 'I could not generate a response.';
}
