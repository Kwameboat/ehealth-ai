/** Smart assistant UI — mirrors backend/services/smartIntents.js */

export const SMART_WELCOME = (name) =>
  `Hi${name ? ` ${name}` : ''}! I'm Agyenim — your smart health companion for Ghana.

I do much more than symptom checks:
• NHIS coverage & Ghana diet coaching
• Find pharmacy, lab, clinic or hospital
• Scan medicines & prescriptions from photos
• Log BP, set reminders, book video doctors
• General health questions anytime

Describe symptoms, ask anything, send a photo, or tap a quick action below. Type *menu* to see all features.`;

export const SUGGESTION_CHIPS = [
  { id: 'menu', label: '📋 Menu', prompt: 'menu' },
  { id: 'nhis', label: 'NHIS', prompt: 'Does NHIS cover antenatal care?' },
  { id: 'diet', label: 'Diet', prompt: 'Can I eat banku with hypertension?' },
  { id: 'facility', label: 'Find pharmacy', prompt: 'Find a pharmacy near me' },
  { id: 'bp', label: 'Log BP', prompt: 'BP: 120/80' },
  { id: 'doctor', label: 'Book doctor', screen: 'DoctorConsult' },
  { id: 'scan', label: 'Scan medicine', screen: 'MedicineRecognition' },
  { id: 'symptoms', label: 'Symptoms', prompt: 'I have a headache and fever' },
];

export const INTENT_TYPING = {
  menu: 'Loading your health menu…',
  nhis: 'Checking NHIS guidance…',
  diet: 'Reviewing nutrition advice…',
  facility: 'Preparing facility finder…',
  bp_log: 'Logging your reading…',
  family: 'Opening family health…',
  consult: 'Finding doctors…',
  emergency: 'Checking emergency guidance…',
  prescription: 'Reading your prescription…',
  lab: 'Analyzing lab report…',
  medicine: 'Identifying medicine…',
  symptom: null,
  general: 'Thinking…',
};

export function typingForIntent(intent, history, hasAttachments) {
  if (hasAttachments) return 'Analyzing your photo…';
  if (intent && INTENT_TYPING[intent]) return INTENT_TYPING[intent];
  return null;
}
