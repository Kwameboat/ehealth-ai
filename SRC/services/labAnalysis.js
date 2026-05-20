import { formatClinicalResponse } from '../utils/formatClinicalResponse';
import { attachmentToBase64, guessImageMimeType } from './fileToBase64';
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

function buildPrompt(fileCount) {
  const multi =
    fileCount > 1
      ? `Review all ${fileCount} attached lab report files (images and/or PDFs) together. `
      : 'Review the attached lab report. ';
  return `${LAB_INSTRUCTIONS}

${multi}Summarize visible test names and values, then complete all sections.`;
}

function getRawText(data) {
  const parts = data?.candidates?.[0]?.content?.parts || [];
  return parts.map((p) => p.text || '').join('').trim();
}

async function generateLab(contents, featureKey) {
  let data = await generateContent({ contents }, { featureKey });
  let combined = getRawText(data);
  const truncated = data?.candidates?.[0]?.finishReason;
  if (combined && (truncated === 'MAX_TOKENS' || truncated === 'LENGTH')) {
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

async function assetsToInlineParts(assets) {
  const parts = [];
  for (const asset of assets) {
    const base64 = asset.base64 || (await attachmentToBase64(asset));
    const mimeType =
      asset.mimeType ||
      (asset.kind === 'pdf'
        ? 'application/pdf'
        : guessImageMimeType(asset.uri, asset.name));
    parts.push({ inline_data: { mime_type: mimeType, data: base64 } });
  }
  return parts;
}

/**
 * Analyze one or more lab images/PDFs (web-safe base64 reading).
 * @param {{ assets: Array<{ uri?, file?, name?, mimeType?, kind?, base64? }> }} params
 */
export async function analyzeLabFromAssets({ assets }) {
  const list = (assets || []).filter(Boolean);
  if (!list.length) throw new Error('No lab files to analyze');

  const inlineParts = await assetsToInlineParts(list);
  const contents = [
    {
      role: 'user',
      parts: [{ text: buildPrompt(list.length) }, ...inlineParts],
    },
  ];
  return generateLab(contents, 'lab_report');
}

/** @deprecated Use analyzeLabFromAssets */
export async function analyzeLabFromImage({ base64, mimeType = 'image/jpeg' }) {
  return analyzeLabFromAssets({
    assets: [{ base64, mimeType, kind: 'image' }],
  });
}

/** @deprecated Use analyzeLabFromAssets */
export async function analyzeLabFromPdf({ base64 }) {
  return analyzeLabFromAssets({
    assets: [{ base64, mimeType: 'application/pdf', kind: 'pdf' }],
  });
}
