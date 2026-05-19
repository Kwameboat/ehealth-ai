import { formatClinicalResponse } from '../utils/formatClinicalResponse';
import { generateContent } from './geminiClient';

const CLINICAL_INSTRUCTIONS = `You are writing a clinical assessment for a patient in eHealth AI.

STYLE (mandatory):
- Professional medical tone, clear and informative (like an experienced clinician explaining to the patient).
- Plain text only: NO markdown, NO asterisks, NO bullet symbols, NO numbered question lists.
- Do NOT say you are AI, a bot, an assistant, or a language model.
- Do NOT repeat, quote, or restate the patient's message or ask follow-up questions.
- Base conclusions on what the patient reported; if information is limited, give balanced guidance for this condition category.

CONTENT (be adequately detailed, not one-line answers):
- Explain what the symptoms may suggest in plain language (2–4 sentences).
- Give several plausible possible causes (typically 3–6), described in full sentences separated by line breaks—not a terse list.
- Give practical recommendations: self-care, rest, hydration, OTC options where appropriate, what to monitor, lifestyle measures (about 4–7 sentences).
- State clearly when to seek urgent/emergency care vs routine clinic follow-up.

STRUCTURE — use exactly these headings on their own line:
Assessment
Possible causes
Recommendations
When to seek care

Aim for about 280–420 words total. Do not be overly brief.`;

function buildTextPrompt(condition, userText) {
  return `${CLINICAL_INSTRUCTIONS}

Condition category: ${condition}

Patient information (facts only — do not repeat verbatim):
${userText.trim()}`;
}

function buildImagePrompt(condition) {
  return `${CLINICAL_INSTRUCTIONS}

Condition category: ${condition}

Review the attached clinical image. Describe only what is reasonably visible, then provide Assessment, Possible causes (3–5 plausible considerations), detailed Recommendations, and When to seek care. Do not claim a definitive diagnosis from the image alone. Use the same depth and headings as text assessments (about 280–420 words).`;
}

function extractText(data) {
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!raw) throw new Error('No response from clinical analysis');
  return formatClinicalResponse(raw);
}

/**
 * @param {{ condition: string, userText: string }} params
 */
export async function analyzeSymptomFromText({ condition, userText }) {
  const data = await generateContent(
    {
      contents: [{ parts: [{ text: buildTextPrompt(condition, userText) }] }],
    },
    { featureKey: 'symptom_text' }
  );
  return extractText(data);
}

/**
 * @param {{ condition: string, base64: string, mimeType?: string }} params
 */
export async function analyzeSymptomFromImage({ condition, base64, mimeType = 'image/jpeg' }) {
  const data = await generateContent(
    {
      contents: [
        {
          parts: [
            { text: buildImagePrompt(condition) },
            { inline_data: { mime_type: mimeType, data: base64 } },
          ],
        },
      ],
    },
    { featureKey: 'symptom_image' }
  );
  return extractText(data);
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
