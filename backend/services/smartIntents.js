/** Intent detection — keep in sync with backend/whatsapp/src/intents.ts */

const MENU_TEXT = `🏥 *Agyenim Health Menu*

I'm your smart health companion — not just symptom triage. I can help with:

1️⃣ **Symptoms** — describe how you feel; I'll ask follow-ups then advise
2️⃣ **NHIS** — coverage & benefits in Ghana
3️⃣ **Diet** — Ghanaian meals for diabetes & hypertension
4️⃣ **Find care** — pharmacy, lab, clinic or hospital near you
5️⃣ **Family profiles** — manage loved ones' health
6️⃣ **Blood pressure** — log with "BP: 120/80"
7️⃣ **Medicine photos** — scan pills, prescriptions & lab reports
8️⃣ **Video doctor** — book a consultation in the app
9️⃣ **Reminders & delivery** — medication schedules & MoMo delivery

Type a question, tap a quick action below, or send a photo anytime.`;

function detectIntent(text) {
  const t = String(text || '').toLowerCase().trim();

  if (/^(menu|help|features|options|what can you do)$/.test(t)) return 'menu';
  if (/\b(emergency|ambulance|112|911|999|life.?threat)\b/.test(t)) return 'emergency';
  if (/\bnhis\b|national health insurance|nhis cover|insurance cover/.test(t)) return 'nhis';
  if (
    /\b(diabetes|hypertension|sugar|type 2|fufu|banku|kontomire|waakye|plantain|diet|nutrition|eat|food)\b/.test(
      t
    ) &&
    !/\bbp[:\s]+\d|blood pressure[:\s]+\d|log bp/.test(t)
  ) {
    return 'diet';
  }
  if (
    /\b(pharmacy|lab|laboratory|clinic|hospital|nearest|find doctor|where.*(pharmacy|clinic|hospital|lab))\b/.test(
      t
    )
  ) {
    return 'facility';
  }
  if (/\bfamily\b|grandma|grandpa|dependent|profile:|add profile|my profiles/.test(t)) return 'family';
  if (/\bbp[:\s]+\d|blood pressure[:\s]+\d|log bp|log blood pressure/.test(t)) return 'bp_log';
  if (/\b(book|video consult|see a doctor|doctor appointment|telehealth|consultation)\b/.test(t)) {
    return 'consult';
  }
  if (/\b(remind|reminder|medication schedule|pill schedule|set reminder)\b/.test(t)) return 'reminder';
  if (/\b(deliver|delivery|order medicine|momo.*medicine)\b/.test(t)) return 'delivery';
  if (/\b(points|buy points|balance|top.?up)\b/.test(t)) return 'points';

  return 'general';
}

function looksLikeSymptomTriage(text) {
  const t = String(text || '').toLowerCase().trim();
  if (!t) return false;
  if (/\b(what is|how does|explain|tell me about|define)\b/.test(t)) return false;
  return /\b(pain|hurt|hurts|ache|aching|fever|chills|cough|sick|symptom|feel ill|feel unwell|nausea|vomit|dizzy|swollen|rash|bleed|bleeding|can't breathe|cannot breathe|breathing trouble|headache|migraine|stomach|chest|throat|diarrhea|constipation|weakness|fatigue|palpitation|burning|itch|infection)\b/.test(
    t
  );
}

function facilityTypeFromText(text) {
  const t = String(text || '').toLowerCase();
  if (/\bhospital\b/.test(t)) return 'hospital';
  if (/\b(clinic|doctor)\b/.test(t)) return 'clinic';
  if (/\b(lab|laboratory)\b/.test(t)) return 'lab';
  return 'pharmacy';
}

const MENU_ACTIONS = [
  { id: 'symptoms', label: 'Check symptoms', screen: 'MedicalChat', params: { initialMessage: 'I have symptoms I want to discuss' } },
  { id: 'nhis', label: 'NHIS Assistant', screen: 'HealthChatFeature', params: { mode: 'nhis' } },
  { id: 'diet', label: 'Diet Coach', screen: 'HealthChatFeature', params: { mode: 'diet' } },
  { id: 'facility', label: 'Find care near me', screen: 'FacilityFinder' },
  { id: 'bp', label: 'BP Tracker', screen: 'BpTracker' },
  { id: 'reminders', label: 'Medication reminders', screen: 'MedicationReminders' },
  { id: 'doctor', label: 'Video consultation', screen: 'DoctorConsult' },
  { id: 'scan', label: 'Scan medicine', screen: 'MedicineRecognition' },
  { id: 'hub', label: 'All health services', screen: 'HealthHub' },
];

module.exports = {
  MENU_TEXT,
  MENU_ACTIONS,
  detectIntent,
  looksLikeSymptomTriage,
  facilityTypeFromText,
};
