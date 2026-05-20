import { formatClinicalResponse } from '../utils/formatClinicalResponse';
import { attachmentToBase64, guessImageMimeType } from './fileToBase64';
import { generateContent } from './geminiClient';

const CLINICAL_INSTRUCTIONS = `You are writing a clinical assessment for a patient in eHealth AI.

STYLE (mandatory):
- Professional medical tone, clear and informative (like an experienced clinician explaining to the patient).
- PLAIN TEXT ONLY. Forbidden: # headers, ### titles, **bold**, * bullets, --- lines, numbered lists, markdown of any kind.
- Use exactly four section headings below — copy each heading word-for-word on its own line. Do not invent other titles (no "Dermatological Analysis", no "Potential Diagnoses").
- Do NOT include disclaimers about being AI or "informational purposes only".
- Do NOT say you are AI, a bot, an assistant, or a language model.
- Do NOT open with phrases like "It sounds like" or "I understand that". Start with the heading Assessment on the first line.
- Do NOT repeat, quote, or restate the patient's message or ask follow-up questions.
- Base conclusions on what the patient reported or what is visible in an image; if information is limited, give balanced guidance for this condition category.
- You MUST complete all four sections. Never stop mid-sentence. The Recommendations section is required every time.

CONTENT:
- Assessment: what the presentation may suggest (2–4 sentences).
- Possible causes: 3–6 plausible causes in full sentences (one per line).
- Recommendations: practical self-care, monitoring, OTC options where appropriate, lifestyle measures (4–6 sentences). Required.
- When to seek care: urgent red flags vs routine follow-up (2–4 sentences).

STRUCTURE — use exactly these headings on their own line, in this order (nothing else):
Assessment
Possible causes
Recommendations
When to seek care`;

function buildTextPrompt(condition, userText) {
  return `${CLINICAL_INSTRUCTIONS}

Condition category: ${condition}

Patient information (facts only — do not repeat verbatim):
${userText.trim()}`;
}

function buildImagePrompt(condition, fileCount = 1) {
  const multi =
    fileCount > 1
      ? `Review all ${fileCount} attached clinical images or documents together as one case. `
      : 'Review the attached clinical image. ';
  return `${CLINICAL_INSTRUCTIONS}

Condition category: ${condition}

${multi}Describe only what is reasonably visible, then complete all four sections. Do not claim a definitive diagnosis from the image alone.`;
}

function getCandidate(data) {
  return data?.candidates?.[0];
}

function getRawText(data) {
  const parts = getCandidate(data)?.content?.parts || [];
  return parts.map((p) => p.text || '').join('').trim();
}

function isTruncated(data) {
  const reason = getCandidate(data)?.finishReason;
  return reason === 'MAX_TOKENS' || reason === 'LENGTH';
}

function isComplete(text) {
  const t = text.trim();
  return (
    /recommendations/i.test(t) &&
    /when to seek care/i.test(t) &&
    !/\b(and|or|the|of|to|for|with|in)\s*$/i.test(t)
  );
}

async function generateWithContinuation(contents, featureKey) {
  let data = await generateContent({ contents }, { featureKey });
  let combined = getRawText(data);

  for (let attempt = 0; attempt < 2 && isTruncated(data) && combined; attempt += 1) {
    const contData = await generateContent(
      {
        contents: [
          ...contents,
          { role: 'model', parts: [{ text: combined }] },
          {
            role: 'user',
            parts: [
              {
                text: 'Your previous reply was cut off. Continue exactly where you stopped. Complete any missing sections (Possible causes, Recommendations, When to seek care). Do not repeat text already written. Plain text only — no # or * symbols. Use the same four headings only.',
              },
            ],
          },
        ],
      },
      { featureKey }
    );
    const more = getRawText(contData);
    if (more) combined = `${combined}\n\n${more}`;
    data = contData;
  }

  if (!combined) throw new Error('No response from clinical analysis');

  const condition =
    contents[0]?.parts?.find((p) => p.text)?.text?.match(/Condition category:\s*(.+)/i)?.[1]?.trim() || '';

  return formatClinicalResponse(combined, condition);
}

/**
 * @param {{ condition: string, userText: string }} params
 */
export async function analyzeSymptomFromText({ condition, userText }) {
  const contents = [{ role: 'user', parts: [{ text: buildTextPrompt(condition, userText) }] }];
  return generateWithContinuation(contents, 'symptom_text');
}

/**
 * @param {{ condition: string, base64: string, mimeType?: string }} params
 */
export async function analyzeSymptomFromImage({ condition, base64, mimeType = 'image/jpeg' }) {
  return analyzeSymptomFromAssets({
    condition,
    assets: [{ base64, mimeType, kind: 'image' }],
  });
}

/**
 * @param {{ condition: string, assets: Array<{ uri?: string, file?: File | Blob, base64?: string, mimeType?: string, kind?: string }> }} params
 */
export async function analyzeSymptomFromAssets({ condition, assets }) {
  const items = [];
  for (const asset of assets || []) {
    if (asset.base64) {
      items.push({
        base64: asset.base64,
        mimeType: asset.mimeType || 'image/jpeg',
      });
      continue;
    }
    const base64 = await attachmentToBase64(asset);
    const mimeType =
      asset.mimeType ||
      (asset.kind === 'pdf'
        ? 'application/pdf'
        : guessImageMimeType(asset.uri, asset.name));
    items.push({ base64, mimeType });
  }
  if (!items.length) throw new Error('No files to analyze');

  const parts = [{ text: buildImagePrompt(condition, items.length) }];
  for (const item of items) {
    parts.push({ inline_data: { mime_type: item.mimeType, data: item.base64 } });
  }

  const contents = [{ role: 'user', parts }];
  return generateWithContinuation(contents, 'symptom_image');
}

/** Screen name → condition label (prefilled categories) */
export const CONDITION_LABELS = {
  HeadacheMigraine: 'Headache & Migraine',
  FeverChills: 'Fever & Chills',
  VomitingNausea: 'Vomiting & Nausea',
  CoughCold: 'Cough & Cold',
  Allergies: 'Allergies',
  SkinProblems: 'Skin Issues',
  BreathingProblems: 'Breathing Problems',
  DentalPain: 'Dental Pain',
  ChestPain: 'Chest Pain',
  StomachProblems: 'Stomach Pain',
  DiarrheaConstipation: 'Diarrhea & Constipation',
  JointMusclePain: 'Joint & Muscle Pain',
  MedicalHealth: 'Mental Health',
  EyeProblems: 'Eye Problems',
  GeneralFatigue: 'General Fatigue',
};
