import { formatClinicalResponse } from '../utils/formatClinicalResponse';
import { generateContent } from './geminiClient';

const CLINICAL_INSTRUCTIONS = `You are writing a clinical assessment for a patient in eHealth AI.

STYLE (mandatory):
- Professional medical tone, clear and informative (like an experienced clinician explaining to the patient).
- Plain text only: NO markdown, NO asterisks, NO bullet symbols, NO numbered question lists.
- Do NOT say you are AI, a bot, an assistant, or a language model.
- Do NOT open with phrases like "It sounds like" or "I understand that". Start directly with clinical content.
- Do NOT repeat, quote, or restate the patient's message or ask follow-up questions.
- Base conclusions on what the patient reported; if information is limited, give balanced guidance for this condition category.
- You MUST finish all four sections below. Never stop mid-sentence or mid-section.

CONTENT:
- Assessment: what the presentation may suggest (2–4 sentences).
- Possible causes: 3–6 plausible causes in full sentences (one per line or short paragraph).
- Recommendations: practical self-care, monitoring, OTC options where appropriate, lifestyle measures (4–6 sentences).
- When to seek care: urgent red flags vs routine follow-up (2–4 sentences).

STRUCTURE — use exactly these headings on their own line, in this order:
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

function buildImagePrompt(condition) {
  return `${CLINICAL_INSTRUCTIONS}

Condition category: ${condition}

Review the attached clinical image. Describe only what is reasonably visible, then complete all four sections. Do not claim a definitive diagnosis from the image alone.`;
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
  return /when to seek care/i.test(text) && !/\b(and|or|the|of|to|for|with|in)\s*$/i.test(text.trim());
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
                text: 'Your previous reply was cut off. Continue exactly where you stopped. Complete any missing sections (Possible causes, Recommendations, When to seek care). Do not repeat text already written. Plain text only, same headings.',
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
  if (!isComplete(combined) && !/when to seek care/i.test(combined)) {
    combined += '\n\nWhen to seek care\nSeek urgent medical attention if symptoms worsen suddenly, if you develop chest pain, difficulty breathing, confusion, or inability to keep fluids down. Otherwise arrange a routine visit with a clinician within a few days for evaluation.';
  }

  return formatClinicalResponse(combined);
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
  const contents = [
    {
      role: 'user',
      parts: [
        { text: buildImagePrompt(condition) },
        { inline_data: { mime_type: mimeType, data: base64 } },
      ],
    },
  ];
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
