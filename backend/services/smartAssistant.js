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

const DEFAULT_GENERAL_PROMPT =
  'You are Agyenim, the eHealth AI smart health companion for Ghana. You help with symptoms, NHIS, diet, finding care, family health, medications, and general wellness — not only triage. Give concise, caring guidance in plain language with culturally relevant examples (Ghanaian foods, NHIS, local clinics). You are not a doctor — advise seeing a clinician when needed. If the user describes acute symptoms, offer to walk them through a structured symptom check. Keep replies under 200 words unless listing steps.';

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
  const systemPrompt = getSetting('whatsapp_system_prompt') || DEFAULT_GENERAL_PROMPT;
  const contents = [...historyToGemini(history), { role: 'user', parts: [{ text: String(userText).trim() }] }];
  const data = await callGemini(contents, undefined, { systemInstruction: systemPrompt });
  const reply = getChatText(data);
  if (!reply) throw new Error('No response from the assistant');
  return reply;
}

function buildResult({ reply, intent, featureKey, actions = [], phase, triageTurn, recommending }) {
  return {
    reply,
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
        extract.medicationName ? `\n💊 *${extract.medicationName}*` : '',
        extract.dosageInstructions ? `\n${extract.dosageInstructions}` : '',
        '\nWould you like to set daily reminders or order delivery?',
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
        reply: `${extract.summary || 'This looks like a lab report.'}\n\nI can explain results in simple terms or help you find a doctor for follow-up.`,
        intent: 'lab',
        featureKey: 'chat_image',
        actions: [
          { id: 'lab', label: 'Open lab analyzer', screen: 'LabResults' },
          { id: 'doctor', label: 'Book video consult', screen: 'DoctorConsult' },
        ],
      });
    }
  } catch {
    /* fall through to medicine scan */
  }

  try {
    const scan = await analyzeMedicineImage(b64, mime);
    return buildResult({
      reply: `💊 *${scan.name}* (${scan.type})\n\n*Uses:* ${scan.uses || '—'}\n*Typical dosing:* ${scan.dosage || 'Check label or pharmacist'}\n*Watch for:* ${scan.sideEffects || '—'}\n*Safety:* ${scan.warnings || 'Confirm with a pharmacist'}\n\nConfidence: ${scan.confidence}%`,
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
        reply: MENU_TEXT,
        intent: 'menu',
        featureKey: 'chat_text',
        actions: MENU_ACTIONS,
      });

    case 'emergency':
      return buildResult({
        reply:
          '🚨 *Possible emergency*\n\nIf you or someone else is in immediate danger, call **112** (Ghana) or go to the nearest emergency department now.\n\nDo not wait for chat advice. I can help find nearby hospitals in the app.',
        intent: 'emergency',
        featureKey: 'chat_text',
        actions: [
          { id: 'emergency', label: 'Find emergency hospitals', screen: 'Emergency' },
          { id: 'facility', label: 'Nearest hospital', screen: 'FacilityFinder', params: { type: 'hospital' } },
        ],
      });

    case 'nhis': {
      const answer = await answerNhisQuestion(text, history);
      return buildResult({
        reply: answer,
        intent: 'nhis',
        featureKey: 'pwa_nhis',
        actions: [{ id: 'nhis', label: 'Open NHIS chat', screen: 'HealthChatFeature', params: { mode: 'nhis' } }],
      });
    }

    case 'diet': {
      const answer = await answerDietQuestion(text, history);
      return buildResult({
        reply: answer,
        intent: 'diet',
        featureKey: 'pwa_diet',
        actions: [{ id: 'diet', label: 'Open diet coach', screen: 'HealthChatFeature', params: { mode: 'diet' } }],
      });
    }

    case 'bp_log': {
      const parsed = parseBloodPressure(text);
      if (!parsed) {
        return buildResult({
          reply: 'To log blood pressure, send a reading like **BP: 120/80** or open the BP Tracker.',
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
        reply: `✅ Logged **${parsed.valueText}**\n\n${bpInterpretation(parsed.systolic, parsed.diastolic)}`,
        intent: 'bp_log',
        featureKey: 'pwa_bp_log',
        actions: [{ id: 'bp', label: 'View BP history', screen: 'BpTracker' }],
      });
    }

    case 'facility': {
      const type = facilityTypeFromText(text);
      return buildResult({
        reply: `I can find a nearby ${type} using your GPS. Open the facility finder and allow location — I'll show options on the map.`,
        intent: 'facility',
        featureKey: 'pwa_facility',
        actions: [{ id: 'facility', label: `Find nearby ${type}`, screen: 'FacilityFinder', params: { type } }],
      });
    }

    case 'family':
      return buildResult({
        reply:
          'Family profiles let you track health for loved ones — Grandma, children, and more. Open Family Profiles to add or edit members.',
        intent: 'family',
        featureKey: 'chat_text',
        actions: [{ id: 'family', label: 'Manage family profiles', screen: 'FamilyProfiles' }],
      });

    case 'consult':
      return buildResult({
        reply:
          'Book a video consultation with a licensed doctor right in the app. Choose a doctor, pick a time slot, and join via secure video.',
        intent: 'consult',
        featureKey: 'chat_text',
        actions: [{ id: 'doctor', label: 'Book video consultation', screen: 'DoctorConsult' }],
      });

    case 'reminder':
      return buildResult({
        reply: 'Set daily medication reminders with dose times. You can also scan a prescription photo in chat to auto-fill the medicine name.',
        intent: 'reminder',
        featureKey: 'chat_text',
        actions: [{ id: 'reminders', label: 'Medication reminders', screen: 'MedicationReminders' }],
      });

    case 'delivery':
      return buildResult({
        reply: 'Order medicine delivery with MoMo payment. A partner pharmacy will process your order after payment.',
        intent: 'delivery',
        featureKey: 'chat_text',
        actions: [{ id: 'delivery', label: 'Order medicine delivery', screen: 'MedicineDelivery' }],
      });

    case 'points':
      return buildResult({
        reply: 'Buy points to use AI features, or view your usage history in the app.',
        intent: 'points',
        featureKey: 'chat_text',
        actions: [
          { id: 'buy', label: 'Buy points', screen: 'BuyPoints' },
          { id: 'history', label: 'Points history', screen: 'PointsHistory' },
        ],
      });

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
    actions: [
      { id: 'symptoms', label: 'Check my symptoms', screen: 'MedicalChat', params: { initialMessage: text } },
      { id: 'hub', label: 'Explore health services', screen: 'HealthHub' },
    ],
  });
}

module.exports = { smartChat, MENU_TEXT, MENU_ACTIONS };
