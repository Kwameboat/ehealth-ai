import { formatClinicalResponse } from '../utils/formatClinicalResponse';
import { generateContent } from './geminiClient';

const LAB_INSTRUCTIONS = `You are interpreting a laboratory report for a patient in eHealth AI.

STYLE:
- Professional clinical tone, plain text only (no markdown, no asterisks, no bullet symbols).
- Do NOT say you are AI. Do NOT include long disclaimers.
- Explain results in plain language the patient can understand.
- Note which values appear high, low, or normal when visible.
- Do NOT claim a definitive diagnosis.

STRUCTURE — use these headings on their own line:
Summary
Key findings
What this may mean
Recommendations
When to seek care`;

function buildImagePrompt() {
  return `${LAB_INSTRUCTIONS}

Review the attached lab report image. Describe only what is reasonably visible, then complete all sections.`;
}

function buildPdfPrompt() {
  return `${LAB_INSTRUCTIONS}

Review the attached lab report PDF. Summarize visible test names and values, then complete all sections.`;
}

function getRawText(data) {
  const parts = data?.candidates?.[0]?.content?.parts || [];
  return parts.map((p) => p.text || '').join('').trim();
}

async function generateLab(contents, featureKey) {
  let data = await generateContent({ contents }, { featureKey });
  let combined = getRawText(data);
  const truncated = data?.candidates?.[0]?.finishReason;
  if (
    combined &&
    (truncated === 'MAX_TOKENS' || truncated === 'LENGTH')
  ) {
    const cont = await generateContent(
      {
        contents: [
          ...contents,
          { role: 'model', parts: [{ text: combined }] },
          {
            role: 'user',
            parts: [
              {
                text: 'Continue where you stopped. Complete remaining sections. Plain text only, same headings.',
              },
            ],
          },
        ],
      },
      { featureKey }
    );
    const more = getRawText(cont);
    if (more) combined = `${combined}\n\n${more}`;
  }
  if (!combined) throw new Error('No response from lab analysis');
  return formatClinicalResponse(combined);
}

export async function analyzeLabFromImage({ base64, mimeType = 'image/jpeg' }) {
  const contents = [
    {
      role: 'user',
      parts: [
        { text: buildImagePrompt() },
        { inline_data: { mime_type: mimeType, data: base64 } },
      ],
    },
  ];
  return generateLab(contents, 'lab_report');
}

export async function analyzeLabFromPdf({ base64 }) {
  const contents = [
    {
      role: 'user',
      parts: [
        { text: buildPdfPrompt() },
        { inline_data: { mime_type: 'application/pdf', data: base64 } },
      ],
    },
  ];
  return generateLab(contents, 'lab_report');
}
