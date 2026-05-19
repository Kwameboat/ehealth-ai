/**
 * Server-side clinical text formatter (keep in sync with SRC/utils/formatClinicalResponse.js).
 */

const HEADING_ALIASES = [
  [/^#{0,6}\s*(?:\d+[.)]\s*)?Dermatological Analysis[^\n]*/gim, 'Assessment'],
  [/^#{0,6}\s*(?:\d+[.)]\s*)?(?:Clinical )?Assessment[^\n]*/gim, 'Assessment'],
  [/^#{0,6}\s*(?:\d+[.)]\s*)?Analysis of[^\n]*/gim, 'Assessment'],
  [/^#{0,6}\s*(?:\d+[.)]\s*)?Analysis[^\n]*/gim, 'Assessment'],
  [/^#{0,6}\s*(?:\d+[.)]\s*)?Common [^\n]*Types[^\n]*/gim, 'Possible causes'],
  [/^#{0,6}\s*(?:\d+[.)]\s*)?Potential Diagnoses[^\n]*/gim, 'Possible causes'],
  [/^#{0,6}\s*(?:\d+[.)]\s*)?Possible (?:causes|diagnoses)[^\n]*/gim, 'Possible causes'],
  [/^#{0,6}\s*(?:\d+[.)]\s*)?Causes[^\n]*/gim, 'Possible causes'],
  [/^#{0,6}\s*(?:\d+[.)]\s*)?(?:Treatment|Care|Management)(?:\s+and)?\s+Recommendations[^\n]*/gim, 'Recommendations'],
  [/^#{0,6}\s*(?:\d+[.)]\s*)?Recommendations[^\n]*/gim, 'Recommendations'],
  [/^#{0,6}\s*(?:\d+[.)]\s*)?Self[- ]?care[^\n]*/gim, 'Recommendations'],
  [/^#{0,6}\s*(?:\d+[.)]\s*)?When to (?:seek|get)[^\n]*/gim, 'When to seek care'],
  [/^#{0,6}\s*(?:\d+[.)]\s*)?When to Seek Help[^\n]*/gim, 'When to seek care'],
  [/^#{0,6}\s*(?:\d+[.)]\s*)?Red flags[^\n]*/gim, 'When to seek care'],
  [/^#{0,6}\s*(?:\d+[.)]\s*)?Disclaimer[^\n]*/gim, ''],
  [/^#{0,6}\s*(?:\d+[.)]\s*)?Important (?:note|disclaimer)[^\n]*/gim, ''],
];

const DEFAULT_RECOMMENDATIONS = {
  skin:
    'Keep the affected area clean and dry. Avoid scratching, harsh soaps, and new skin products until evaluated. Use fragrance-free moisturizer; for itch, a cool compress or OTC antihistamine may help if appropriate for you. See a clinician if the rash spreads or does not improve within a few days.',
  headache:
    'Rest in a quiet, dark room and stay hydrated. Avoid known triggers such as skipped meals, poor sleep, and stress. OTC pain relief may help if safe for you and used as directed on the label. Keep a brief headache diary (timing, location, severity, triggers).',
  default:
    'Rest as needed, stay hydrated, and monitor symptoms. Avoid triggers you can identify. Use over-the-counter options only as directed and if safe for your health conditions and medications. Follow up with a clinician if symptoms persist or worsen.',
};

const DEFAULT_WHEN_TO_SEEK =
  'Seek urgent medical attention if you develop difficulty breathing, chest pain, confusion, high fever, the worst headache of your life, sudden weakness, vision changes, or signs of stroke. Otherwise arrange a routine visit if symptoms are not improving within a few days or are interfering with daily activities.';

function stripMarkdown(raw) {
  if (!raw || typeof raw !== 'string') return '';
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/^#{1,6}/gm, '')
    .replace(/^---+$/gm, '')
    .replace(/^\s*[-*_]{3,}\s*$/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/_([^_\n]+)_/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^\s*[-*+•●]\s+/gm, '')
    .replace(/^\s*\d+[.)]\s+/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeHeadings(text) {
  let out = text;
  for (const [pattern, replacement] of HEADING_ALIASES) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

function dropAiPhrases(text) {
  return text
    .replace(/^[^\n]*\b(?:as an ai|i am an ai|i'?m an ai|i cannot provide medical advice|not a substitute for (?:professional )?medical advice|informational purposes only)[^\n]*\n?/gim, '')
    .replace(/^(?:it'?s important to understand that\s*)?[^\n]{0,300}\b(?:as an ai|cannot provide medical advice)[^\n]*\.\s*\n?/gim, '')
    .replace(/\bas an ai\b[^.!\n]*/gi, '')
    .replace(/\bi am an ai\b[^.!\n]*/gi, '')
    .replace(/\bi'?m an ai\b[^.!\n]*/gi, '')
    .replace(/\blanguage model\b/gi, 'clinical reference')
    .replace(/\bchatbot\b/gi, 'service')
    .replace(/\b(as an )?ai (assistant|model)\b/gi, 'clinical service')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function hasSection(text, name) {
  return new RegExp(`^${name}\\s*$`, 'im').test(text);
}

function defaultRecommendations(condition = '') {
  const c = (condition || '').toLowerCase();
  if (c.includes('skin') || c.includes('dermat') || c.includes('rash')) {
    return DEFAULT_RECOMMENDATIONS.skin;
  }
  if (c.includes('headache') || c.includes('migraine')) {
    return DEFAULT_RECOMMENDATIONS.headache;
  }
  return DEFAULT_RECOMMENDATIONS.default;
}

function ensureClinicalSections(text, condition = '') {
  let out = (text || '').trim();
  if (!out) return out;
  if (!hasSection(out, 'Recommendations')) {
    out += `\n\nRecommendations\n${defaultRecommendations(condition)}`;
  }
  if (!hasSection(out, 'When to seek care')) {
    out += `\n\nWhen to seek care\n${DEFAULT_WHEN_TO_SEEK}`;
  }
  return out;
}

function formatClinicalResponse(raw, condition = '') {
  if (!raw || typeof raw !== 'string') return '';
  let text = stripMarkdown(raw);
  text = normalizeHeadings(text);
  text = dropAiPhrases(text);
  text = ensureClinicalSections(text, condition);
  text = stripMarkdown(text);
  return text.trim();
}

function extractConditionFromContents(contents) {
  if (!Array.isArray(contents)) return '';
  for (const item of contents) {
    for (const part of item.parts || []) {
      const m = (part.text || '').match(/Condition category:\s*(.+)/i);
      if (m) return m[1].trim();
    }
  }
  return '';
}

function formatSymptomGeminiResponse(data, contents) {
  const candidate = data?.candidates?.[0];
  if (!candidate?.content?.parts?.length) return data;
  const raw = candidate.content.parts.map((p) => p.text || '').join('');
  const condition = extractConditionFromContents(contents);
  const formatted = formatClinicalResponse(raw, condition);
  return {
    ...data,
    candidates: [
      {
        ...candidate,
        content: {
          ...candidate.content,
          parts: [{ text: formatted }],
        },
      },
    ],
  };
}

function isSymptomFeature(featureKey) {
  return featureKey === 'symptom_text' || featureKey === 'symptom_image';
}

module.exports = {
  formatClinicalResponse,
  formatSymptomGeminiResponse,
  extractConditionFromContents,
  isSymptomFeature,
};
