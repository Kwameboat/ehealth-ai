const { getDb, uuid, now } = require('../db/init');
const { getSetting } = require('./settings');
const { callGemini, chatCompletion, resolveChatFeatureKey } = require('./gemini');
const {
  answerNhisQuestion,
  answerDietQuestion,
  parseBloodPressure,
  bpInterpretation,
} = require('./healthAssistant');
const { analyzeMedicineImage, analyzePrescriptionImage } = require('./visionAssist');
const { countTriageAssistantTurns, shouldGiveRecommendations } = require('./medicalChatPrompt');
const {
  MENU_TEXT,
  MENU_ACTIONS,
  detectIntent,
  looksLikeSymptomTriage,
  facilityTypeFromText,
} = require('./smartIntents');

const PWA_SYSTEM_PROMPT = `You are Agyenim, the eHealth AI smart health assistant inside the eHealth mobile/web app (PWA) for Ghana.

CRITICAL RULES:
- The user is ALREADY in the app chatting with you. Answer their question directly in this conversation.
- NEVER tell them to use WhatsApp, open WhatsApp, message on WhatsApp, or that you are a WhatsApp bot.
- NEVER say "register at ehealthaigh.com" or "visit the website" — they are signed in to the app.
- NEVER redirect them elsewhere to get an answer you can give here.
- Give concise, caring health guidance in plain language with Ghana-relevant examples (NHIS, local foods, clinics).
- You are not a doctor — advise seeing a clinician when appropriate.
- For symptoms, you may ask one focused follow-up question or suggest they describe symptoms for a structured check.
- Keep replies under 200 words unless listing clear steps.`;

function getPwaSystemPrompt() {
  return getSetting('pwa_system_prompt') || PWA_SYSTEM_PROMPT;
}

function sanitizePwaReply(text) {
  let t = String(text || '').trim();
  const rules = [
    [/on whatsapp/gi, 'in this app'],
    [/via whatsapp/gi, 'here in the app'],
    [/through whatsapp/gi, 'in this chat'],
    [/message (us |me )?(on )?whatsapp/gi, 'ask me here'],
    [/chat with (us |me )?(on )?whatsapp/gi, 'chat with me here'],
    [/use whatsapp/gi, 'use this app'],
    [/open whatsapp/gi, 'continue in this chat'],
    [/whatsapp bot/gi, 'health assistant'],
    [/link your whatsapp number[^\n.]*/gi, 'use Account settings if you also want WhatsApp (optional)'],
    [/register at ehealthaigh\.com[^\n.]*/gi, 'use your account in this app'],
    [/visit ehealthaigh\.com[^\n.]*/gi, 'use the features in this app'],
    [/top up at ehealthaigh\.com/gi, 'tap Buy Points in the app'],
    [/ehealthaigh\.com and link your whatsapp[^\n.]*/gi, 'your Account settings in this app'],
  ];
  for (const [re, sub] of rules) {
    t = t.replace(re, sub);
  }
  return t.trim();
}

function getChatText(data) {
  return (data?.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('').trim();
}

function historyToGemini(history) {
  return (history || []).slice(-10).map((msg) => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: String(msg.text || '').trim() || '(attachment)' }],
  }));
}

function isActiveTriageSession(history) {
  const turns = countTriageAssistantTurns(history);
  return turns > 0 && !shouldGiveRecommendations(history);
}

async function generalHealthReply(userText, history) {
  const systemPrompt = getPwaSystemPrompt();
  const contents = [...historyToGemini(history), { role: 'user', parts: [{ text: String(userText).trim() }] }];
  const data = await callGemini(contents, undefined, { systemInstruction: systemPrompt });
  const reply = getChatText(data);
  if (!reply) throw new Error('No response from the assistant');
  return reply;
}

function buildResult({ reply, intent, featureKey, actions = [], phase, triageTurn, recommending }) {
  return {
    reply: sanitizePwaReply(reply),
    featureKey: featureKey || 'chat_text',
    actions,
    meta: {
      intent: intent || 'general',
      phase: phase || intent || 'general',
      triageTurn,
      recommending,
    },
  };
}

async function answerWithOptionalAction(userText, history, intent, featureKey, actions) {
  const answer = await generalHealthReply(userText, history);
  return buildResult({ reply: answer, intent, featureKey, actions });
}

async function handleAttachments(userId, userText, attachment, attachments) {
  const featureKey = resolveChatFeatureKey(attachment, attachments);
  const files = Array.isArray(attachments) && attachments.length ? attachments : attachment ? [attachment] : [];
  const first = files[0];
  if (!first?.base64) {
    const result = await chatCompletion([], userText, attachment, attachments);
    return buildResult({
      reply: result.reply,
      intent: 'symptom',
      featureKey,
      phase: result.meta?.phase,
      triageTurn: result.meta?.triageTurn,
      recommending: result.meta?.recommending,
    });
  }

  const mime = first.mimeType || 'image/jpeg';
  const b64 = first.base64;

  try {
    const extract = await analyzePrescriptionImage(b64, mime, userText);
    if (extract.isPrescription || extract.medicationName) {
      const lines = [
        extract.summary || 'I analyzed your prescription image.',
        extract.medicationName ? `\n💊 ${extract.medicationName}` : '',
        extract.dosageInstructions ? `\n${extract.dosageInstructions}` : '',
        '\nWould you like to set daily reminders or order delivery in the app?',
      ].filter(Boolean);
      return buildResult({
        reply: lines.join(''),
        intent: 'prescription',
        featureKey: 'chat_image',
        actions: [
          {
            id: 'reminder',
            label: 'Set medication reminder',
            screen: 'MedicationReminders',
            params: extract.medicationName ? { medicationName: extract.medicationName } : {},
          },
          {
            id: 'delivery',
            label: 'Order medicine delivery',
            screen: 'MedicineDelivery',
            params: extract.medicationName ? { medicationName: extract.medicationName } : {},
          },
        ],
      });
    }
    if (extract.isLabReport) {
      return buildResult({
        reply: `${extract.summary || 'This looks like a lab report.'}\n\nI can explain results in simple terms or help you book a doctor for follow-up — all in this app.`,
        intent: 'lab',
        featureKey: 'chat_image',
        actions: [
          { id: 'lab', label: 'Open lab analyzer', screen: 'LabResults' },
          { id: 'doctor', label: 'Book video consult', screen: 'DoctorConsult' },
        ],
      });
    }
  } catch {
    /* fall through */
  }

  try {
    const scan = await analyzeMedicineImage(b64, mime);
    return buildResult({
      reply: `💊 ${scan.name} (${scan.type})\n\nUses: ${scan.uses || '—'}\nTypical dosing: ${scan.dosage || 'Check label or pharmacist'}\nWatch for: ${scan.sideEffects || '—'}\nSafety: ${scan.warnings || 'Confirm with a pharmacist'}\n\nConfidence: ${scan.confidence}%`,
      intent: 'medicine',
      featureKey: 'medicine_scan',
      actions: [
        { id: 'reminder', label: 'Add to reminders', screen: 'MedicationReminders', params: { medicationName: scan.name } },
        { id: 'delivery', label: 'Order delivery', screen: 'MedicineDelivery', params: { medicationName: scan.name } },
      ],
    });
  } catch {
    /* fall through */
  }

  const result = await chatCompletion([], userText, attachment, attachments);
  return buildResult({
    reply: result.reply,
    intent: 'symptom',
    featureKey,
    phase: result.meta?.phase,
    triageTurn: result.meta?.triageTurn,
    recommending: result.meta?.recommending,
  });
}

async function smartChat(userId, history = [], userText = '', attachment = null, attachments = null) {
  const text = String(userText || '').trim();
  const hasFiles =
    (Array.isArray(attachments) && attachments.length > 0) || (attachment?.base64 && attachment?.mimeType);

  if (hasFiles) {
    return handleAttachments(userId, text, attachment, attachments);
  }

  if (isActiveTriageSession(history)) {
    const result = await chatCompletion(history, text, null, null);
    return buildResult({
      reply: result.reply,
      intent: 'symptom',
      featureKey: 'chat_text',
      phase: result.meta?.phase,
      triageTurn: result.meta?.triageTurn,
      recommending: result.meta?.recommending,
    });
  }

  const intent = detectIntent(text);

  switch (intent) {
    case 'menu':
      return buildResult({
        reply: MENU_TEXT.replace(/WhatsApp/g, 'app'),
        intent: 'menu',
        featureKey: 'chat_text',
        actions: MENU_ACTIONS,
      });

    case 'emergency':
      return buildResult({
        reply:
          '🚨 Possible emergency\n\nIf you or someone else is in immediate danger, call 112 (Ghana) or go to the nearest emergency department now.\n\nDo not wait for chat advice. I can help find nearby hospitals in the app.',
        intent: 'emergency',
        featureKey: 'chat_text',
        actions: [
          { id: 'emergency', label: 'Find emergency hospitals', screen: 'Emergency' },
          { id: 'facility', label: 'Nearest hospital', screen: 'FacilityFinder', params: { type: 'hospital' } },
        ],
      });

    case 'nhis': {
      const answer = await answerNhisQuestion(text, history);
      return buildResult({ reply: answer, intent: 'nhis', featureKey: 'pwa_nhis' });
    }

    case 'diet': {
      const answer = await answerDietQuestion(text, history);
      return buildResult({ reply: answer, intent: 'diet', featureKey: 'pwa_diet' });
    }

    case 'bp_log': {
      const parsed = parseBloodPressure(text);
      if (!parsed) {
        return buildResult({
          reply: 'To log blood pressure, send a reading like **BP: 120/80** or open the BP Tracker below.',
          intent: 'bp_log',
          featureKey: 'chat_text',
          actions: [{ id: 'bp', label: 'Open BP Tracker', screen: 'BpTracker' }],
        });
      }
      const ts = now();
      getDb()
        .prepare(
          `INSERT INTO health_tracker_logs (id, user_id, profile_id, tracker_type, value_text, value_numeric, created_at)
           VALUES (?, ?, NULL, 'blood_pressure', ?, ?, ?)`
        )
        .run(uuid(), userId, parsed.valueText, parsed.systolic, ts);
      return buildResult({
        reply: `✅ Logged ${parsed.valueText}\n\n${bpInterpretation(parsed.systolic, parsed.diastolic)}`,
        intent: 'bp_log',
        featureKey: 'pwa_bp_log',
        actions: [{ id: 'bp', label: 'View BP history', screen: 'BpTracker' }],
      });
    }

    case 'facility': {
      const type = facilityTypeFromText(text);
      const answer = await generalHealthReply(text, history);
      return buildResult({
        reply: `${answer}\n\nTap below to find a ${type} near you on the map.`,
        intent: 'facility',
        featureKey: 'pwa_facility',
        actions: [{ id: 'facility', label: `Find nearby ${type}`, screen: 'FacilityFinder', params: { type } }],
      });
    }

    case 'family':
      return answerWithOptionalAction(text, history, 'family', 'chat_text', [
        { id: 'family', label: 'Manage family profiles', screen: 'FamilyProfiles' },
      ]);

    case 'consult':
      return answerWithOptionalAction(text, history, 'consult', 'chat_text', [
        { id: 'doctor', label: 'Book video consultation', screen: 'DoctorConsult' },
      ]);

    case 'reminder':
      return answerWithOptionalAction(text, history, 'reminder', 'chat_text', [
        { id: 'reminders', label: 'Medication reminders', screen: 'MedicationReminders' },
      ]);

    case 'delivery':
      return answerWithOptionalAction(text, history, 'delivery', 'chat_text', [
        { id: 'delivery', label: 'Order medicine delivery', screen: 'MedicineDelivery' },
      ]);

    case 'points':
      return answerWithOptionalAction(text, history, 'points', 'chat_text', [
        { id: 'buy', label: 'Buy points', screen: 'BuyPoints' },
        { id: 'history', label: 'Points history', screen: 'PointsHistory' },
      ]);

    default:
      break;
  }

  if (looksLikeSymptomTriage(text)) {
    const result = await chatCompletion(history, text, null, null);
    return buildResult({
      reply: result.reply,
      intent: 'symptom',
      featureKey: 'chat_text',
      phase: result.meta?.phase,
      triageTurn: result.meta?.triageTurn,
      recommending: result.meta?.recommending,
    });
  }

  const reply = await generalHealthReply(text, history);
  return buildResult({
    reply,
    intent: 'general',
    featureKey: 'chat_text',
    actions: [{ id: 'hub', label: 'Explore health services', screen: 'HealthHub' }],
  });
}

module.exports = { smartChat, MENU_TEXT, MENU_ACTIONS, sanitizePwaReply, PWA_SYSTEM_PROMPT };
