import type { WhatsAppConfig } from '../config';
import type { WhatsAppDeps } from '../deps';
import { sendButtonsMessage } from '../interactive';
import { saveSession, getSession, deleteSession } from '../sessionStore';

const NHIS_PROMPT = `You are Agyenim, an NHIS (National Health Insurance Scheme) assistant for Ghana.
Explain typical NHIS coverage in plain language: outpatient visits, selected medications, maternity, child welfare, and that some drugs/procedures may need co-payment or are excluded.
Always say users should confirm at their registered NHIS facility. Never guarantee coverage for a specific drug without caveat.
Keep answers under 180 words unless listing items.`;

export async function answerNhisQuestion(apiKey: string, question: string): Promise<string> {
  const { analyzeWithSpecialtyPrompt } = await import('../gemini');
  return analyzeWithSpecialtyPrompt(apiKey, NHIS_PROMPT, question);
}

const DIET_PROMPT = `You are Agyenim, a Ghana-focused nutrition coach for hypertension and Type 2 diabetes.
Give culturally accurate advice about Ghanaian foods: fufu, banku, rice, yam, plantain, kontomire, light soup, palm nut soup, waakye, kelewele, etc.
Suggest practical swaps (boiled plantain, smaller fufu portions, more kontomire/vegetables, less sugary drinks).
Include a brief post-meal tip (e.g. 15-minute walk). Not a doctor — encourage clinic follow-up for medication changes.`;

export async function answerDietQuestion(apiKey: string, question: string): Promise<string> {
  const { analyzeWithSpecialtyPrompt } = await import('../gemini');
  return analyzeWithSpecialtyPrompt(apiKey, DIET_PROMPT, question);
}

export function logBloodPressure(
  deps: WhatsAppDeps,
  userId: string,
  text: string,
  profileId?: string | null
): string | null {
  const m = text.match(/(\d{2,3})\s*\/\s*(\d{2,3})/);
  if (!m) return null;
  const sys = parseInt(m[1], 10);
  const dia = parseInt(m[2], 10);
  deps
    .getDb()
    .prepare(
      `INSERT INTO health_tracker_logs (id, user_id, profile_id, tracker_type, value_text, value_numeric, created_at)
       VALUES (?, ?, ?, 'blood_pressure', ?, ?, ?)`
    )
    .run(deps.uuid(), userId, profileId || null, `${sys}/${dia}`, sys, deps.now());

  let note = 'Logged successfully.';
  if (sys >= 140 || dia >= 90) note = 'Your reading looks elevated. Rest 5 minutes and recheck, or contact your clinic if persistent.';
  else if (sys < 90 || dia < 60) note = 'Reading looks low. Stay hydrated and seek care if you feel dizzy.';
  else note = 'Reading looks within a normal range. Keep logging weekly!';

  return `🩺 Blood pressure *${sys}/${dia}* recorded.\n${note}`;
}

export async function offerDelivery(
  deps: WhatsAppDeps,
  config: WhatsAppConfig,
  phone: string,
  userId: string,
  medications: string[]
): Promise<void> {
  if (!medications.length) return;
  const med = medications[0];
  const sessionId = saveSession(deps, {
    userId,
    phone,
    sessionType: 'delivery',
    payload: { medicationName: med, estimatedKobo: 4500 },
    ttlMinutes: 60,
  });

  await sendButtonsMessage(config, phone, {
    title: '🛵 Medicine delivery',
    description: `I noticed you may need *${med}*. Would you like pricing and MoMo delivery via our pharmacy partners?\n\nEstimated from ~GHS 45 + delivery.`,
    buttons: [
      { id: `delivery_yes:${sessionId}`, displayText: 'Check & pay 💳' },
      { id: `delivery_no:${sessionId}`, displayText: 'Not now' },
    ],
  });
}

export async function createDeliveryPayment(
  deps: WhatsAppDeps,
  config: WhatsAppConfig,
  phone: string,
  userId: string,
  sessionId: string
): Promise<string> {
  const session = getSession(deps, sessionId);
  if (!session || session.userId !== userId) return 'Delivery session expired. Ask again about your medicine.';

  if (!deps.initializePaystack || !deps.getUserEmail) {
    return 'Payment is not configured yet. Visit ehealthaigh.com or buy from a nearby pharmacy.';
  }

  const med = String(session.payload.medicationName || 'Medication');
  const amountKobo = Number(session.payload.estimatedKobo) || 4500;
  const reference = `wa_del_${deps.uuid().replace(/-/g, '').slice(0, 16)}`;
  const email = deps.getUserEmail(userId) || `${phone}@whatsapp.ehealthaigh.com`;

  try {
    const pay = await deps.initializePaystack({
      email,
      amountMinor: amountKobo,
      currency: 'GHS',
      reference,
      metadata: { userId, medicationName: med, source: 'whatsapp_delivery' },
    });

    const orderId = deps.uuid();
    deps
      .getDb()
      .prepare(
        `INSERT INTO wa_delivery_orders (id, user_id, medication_name, amount_kobo, currency, paystack_reference, paystack_url, status, created_at)
         VALUES (?, ?, ?, ?, 'GHS', ?, ?, 'pending', ?)`
      )
      .run(orderId, userId, med, amountKobo, reference, pay.authorization_url || '', deps.now());

    deleteSession(deps, sessionId);

    return `💳 *Pay for ${med}*\n\nTap to pay with Mobile Money (MoMo):\n${pay.authorization_url}\n\nAfter payment we'll confirm dispatch to your registered number.`;
  } catch (err: unknown) {
    return err instanceof Error ? err.message : 'Could not create payment link.';
  }
}

export async function sendLabFollowUpButtons(
  config: WhatsAppConfig,
  phone: string,
  sessionId: string,
  summary: string
): Promise<void> {
  await sendButtonsMessage(config, phone, {
    title: 'Lab results',
    description: summary.slice(0, 900),
    buttons: [
      { id: `lab_explain:${sessionId}`, displayText: 'Explain simply 📖' },
      { id: `lab_find_doctor:${sessionId}`, displayText: 'Find nearest doctor 🏥' },
    ],
  });
}

export async function handleLabExplain(apiKey: string, summary: string): Promise<string> {
  const { analyzeWithSpecialtyPrompt } = await import('../gemini');
  return analyzeWithSpecialtyPrompt(
    apiKey,
    'Explain these lab results in very simple terms for a Ghanaian patient with no medical background. Use short sentences.',
    summary
  );
}
