import { formatClinicalResponse } from '../utils/formatClinicalResponse';
import { generateContent } from './geminiClient';

const CLINICAL_INSTRUCTIONS = `You are writing a brief clinical assessment for a patient chart in eHealth AI.

STYLE (mandatory):
- Professional medical tone, as a doctor's note to the patient.
- Plain text only: NO markdown, NO asterisks, NO bullet characters, NO numbered questions.
- Do NOT say you are AI, a bot, an assistant, or a language model.
- Do NOT repeat, quote, or restate the patient's message or questions they might have asked.
- Do NOT ask follow-up questions. Give a complete answer from the information provided.
- If details are limited, give prudent guidance for this condition without inventing specific facts.

STRUCTURE — use exactly these headings on separate lines:
Assessment
Recommendations
When to seek care

Keep the full response under 220 words unless urgent/emergency care must be explained clearly.`;

function buildTextPrompt(condition, userText) {
  return `${CLINICAL_INSTRUCTIONS}

Condition category: ${condition}

Patient information (facts only — do not repeat verbatim):
${userText.trim()}`;
}

function buildImagePrompt(condition) {
  return `${CLINICAL_INSTRUCTIONS}

Condition category: ${condition}

Review the attached clinical image. Describe only what is reasonably visible, then give assessment, recommendations, and when to seek care. Do not claim a definitive diagnosis from the image alone.`;
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
