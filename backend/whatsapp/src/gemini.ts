import { GoogleGenAI } from '@google/genai';
import type { WhatsAppConfig } from './config';

const TEXT_MODEL = 'gemini-2.5-flash';
const VISION_MODEL = 'gemini-2.5-pro';

function getAi(apiKey: string) {
  return new GoogleGenAI({ apiKey });
}

function extractText(response: { text?: string; candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }): string {
  if (response.text) return response.text.trim();
  const parts = response.candidates?.[0]?.content?.parts || [];
  return parts.map((p) => p.text || '').join('').trim();
}

export async function analyzeText(
  apiKey: string,
  systemPrompt: string,
  userText: string,
  history: string[] = []
): Promise<string> {
  const ai = getAi(apiKey);
  const context =
    history.length > 0
      ? `Recent conversation:\n${history.slice(-6).join('\n')}\n\nUser: ${userText}`
      : userText;

  const response = await ai.models.generateContent({
    model: TEXT_MODEL,
    contents: [
      {
        role: 'user',
        parts: [{ text: `${systemPrompt}\n\n${context}` }],
      },
    ],
  });

  return extractText(response) || 'I could not generate a response. Please try again.';
}

export async function analyzeAudio(
  apiKey: string,
  systemPrompt: string,
  base64: string,
  mimeType: string
): Promise<string> {
  const ai = getAi(apiKey);
  const response = await ai.models.generateContent({
    model: TEXT_MODEL,
    contents: [
      {
        role: 'user',
        parts: [
          { text: `${systemPrompt}\n\nListen to this voice note and respond helpfully in plain language.` },
          { inlineData: { mimeType: mimeType || 'audio/ogg', data: base64 } },
        ],
      },
    ],
  });
  return extractText(response) || 'I could not process the voice note. Please try again or send text.';
}

export async function analyzeLabOrMedicineImage(
  apiKey: string,
  systemPrompt: string,
  base64: string,
  mimeType: string,
  caption?: string
): Promise<string> {
  const ai = getAi(apiKey);
  const prompt = `${systemPrompt}

Analyze this image. If it looks like a lab report, summarize key values and flag anything that may need clinician review. If it looks like medicine packaging, identify the medicine name, common uses, and general safety reminders. If unclear, say what you see and ask for a clearer photo.
${caption ? `\nUser caption: ${caption}` : ''}`;

  const response = await ai.models.generateContent({
    model: VISION_MODEL,
    contents: [
      {
        role: 'user',
        parts: [
          { text: prompt },
          { inlineData: { mimeType: mimeType || 'image/jpeg', data: base64 } },
        ],
      },
    ],
  });

  return extractText(response) || 'I could not analyze the image. Please send a clearer photo.';
}

export interface PrescriptionExtract {
  isPrescription: boolean;
  isLabReport: boolean;
  medicationName?: string;
  dosageInstructions?: string;
  suggestedTimes?: string[];
  durationDays?: number;
  deliveryMedications?: string[];
  summary?: string;
}

function parseJsonBlock(text: string): Record<string, unknown> | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function extractPrescriptionFromImage(
  apiKey: string,
  base64: string,
  mimeType: string,
  caption?: string
): Promise<PrescriptionExtract> {
  const ai = getAi(apiKey);
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

  const response = await ai.models.generateContent({
    model: VISION_MODEL,
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }, { inlineData: { mimeType: mimeType || 'image/jpeg', data: base64 } }],
      },
    ],
  });

  const raw = extractText(response);
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

export async function analyzeWithSpecialtyPrompt(
  apiKey: string,
  specialtyPrompt: string,
  userText: string
): Promise<string> {
  const ai = getAi(apiKey);
  const response = await ai.models.generateContent({
    model: TEXT_MODEL,
    contents: [{ role: 'user', parts: [{ text: `${specialtyPrompt}\n\nUser: ${userText}` }] }],
  });
  return extractText(response) || 'I could not generate a response.';
}

export { TEXT_MODEL, VISION_MODEL };
