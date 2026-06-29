/** Remove leaked system prompts, internal directives, and boilerplate from user-visible replies. */

const LEAK_PHRASES = [
  /^understood\.?\s*i will ask at most \d+/i,
  /^you are agyenim,?\s*the (professional clinical triage|ehealth ai)/i,
  /conversation style \(strict\)/i,
  /triage flow:/i,
  /critical rules:/i,
  /never tell them to use whatsapp/i,
  /give your final recommendations now in one complete message/i,
  /continue exactly where you (were cut off|stopped)/i,
  /do not repeat the opening/i,
  /internal instruction/i,
  /\[internal instruction/i,
];

const LEAK_SNIPPETS = [
  'CONVERSATION STYLE',
  'TRIAGE FLOW',
  'WHEN GIVING RECOMMENDATIONS',
  'CRITICAL RULES',
  'Internal instruction',
  'MEDICAL_CHAT',
  'system prompt',
  'follow-up questions (one at a time)',
  'I will escalate emergencies immediately',
];

function stripMarkdownNoise(text) {
  return String(text || '')
    .replace(/\*\*/g, '')
    .replace(/^\*+\s/gm, '')
    .trim();
}

function stripPromptLeakage(text) {
  let t = stripMarkdownNoise(text);
  if (!t) return t;

  for (const re of LEAK_PHRASES) {
    if (re.test(t)) {
      t = t.replace(re, '').trim();
    }
  }

  for (const snippet of LEAK_SNIPPETS) {
    const idx = t.indexOf(snippet);
    if (idx >= 0 && idx < 120) {
      t = t.slice(0, idx).trim();
    }
  }

  // Drop paragraphs that look like instruction blocks
  const paragraphs = t.split(/\n{2,}/).filter((p) => {
    const line = p.trim();
    if (!line) return false;
    if (/^(you are|understood|never |do not |always |must |should )/i.test(line) && line.length > 80) {
      return false;
    }
    return true;
  });

  t = paragraphs.join('\n\n').trim();

  // If the model echoed the entire configured prompt (long "You are..." block), discard it
  if (/^you are agyenim/i.test(t) && t.length > 400 && !/\?\s*$/.test(t)) {
    const question = t.match(/([^.!?]+\?)\s*$/);
    t = question ? question[1] : 'How can I help with your health today?';
  }

  return t.trim();
}

function sanitizePwaReply(text) {
  let t = stripPromptLeakage(String(text || '').trim());
  const rules = [
    [/on whatsapp/gi, 'in this app'],
    [/via whatsapp/gi, 'here in the app'],
    [/through whatsapp/gi, 'in this chat'],
    [/message (us |me )?(on )?whatsapp/gi, 'ask me here'],
    [/use whatsapp/gi, 'use this app'],
    [/open whatsapp/gi, 'continue in this chat'],
    [/register at ehealthaigh\.com[^\n.]*/gi, 'use your account in this app'],
    [/visit ehealthaigh\.com[^\n.]*/gi, 'use the features in this app'],
  ];
  for (const [re, sub] of rules) {
    t = t.replace(re, sub);
  }
  return t.trim();
}

module.exports = { sanitizePwaReply, stripPromptLeakage, stripMarkdownNoise };
