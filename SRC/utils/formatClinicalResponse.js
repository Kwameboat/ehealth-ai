/**
 * Plain clinical text for symptom screens (no markdown / AI phrasing).
 */
export function formatClinicalResponse(raw) {
  if (!raw || typeof raw !== 'string') return '';

  let text = raw
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-•●]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/\bas an ai\b[^.!\n]*/gi, '')
    .replace(/\bi am an ai\b[^.!\n]*/gi, '')
    .replace(/\bi'?m an ai\b[^.!\n]*/gi, '')
    .replace(/\blanguage model\b/gi, 'clinical reference')
    .replace(/\bchatbot\b/gi, 'service')
    .replace(/\bassistant\b/gi, 'clinician')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return text;
}
