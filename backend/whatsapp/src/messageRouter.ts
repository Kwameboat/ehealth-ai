import type { WhatsAppConfig } from './config';
import type { WhatsAppDeps } from './deps';
import {
  analyzeAudio,
  analyzeLabOrMedicineImage,
  analyzeText,
  extractPrescriptionFromImage,
} from './gemini';
import { fetchMediaBase64, sendTextMessage } from './evolution';
import { handleButtonOrListReply } from './buttonHandler';
import { findUserByPhone, insertWhatsAppLog, preview } from './logs';
import { normalizePhone } from './phone';
import { detectIntent, MENU_TEXT } from './intents';
import { saveSession } from './sessionStore';
import { offerReminderSetup } from './features/medication';
import {
  answerDietQuestion,
  answerNhisQuestion,
  logBloodPressure,
  offerDelivery,
  sendLabFollowUpButtons,
} from './features/healthFeatures';
import {
  createFamilyProfile,
  formatFamilyList,
  getUpcomingFamilyReminders,
  listFamilyProfiles,
  parseFamilyAddCommand,
} from './features/family';
import { handleLocationShare, promptFacilityType } from './features/facilities';

export type MessageKind = 'text' | 'audio' | 'image' | 'location' | 'interactive' | 'unknown';

export interface ParsedMessage {
  phone: string;
  kind: MessageKind;
  text?: string;
  caption?: string;
  mediaMessage?: unknown;
  buttonId?: string;
  latitude?: number;
  longitude?: number;
  rawPreview: string;
}

const conversationHistory = new Map<string, string[]>();

function pushHistory(phone: string, line: string) {
  const key = normalizePhone(phone);
  const list = conversationHistory.get(key) || [];
  list.push(line);
  if (list.length > 12) list.splice(0, list.length - 12);
  conversationHistory.set(key, list);
}

export function parseEvolutionPayload(body: unknown): ParsedMessage | null {
  if (!body || typeof body !== 'object') return null;

  const root = body as Record<string, unknown>;
  const data = (root.data as Record<string, unknown>) || root;
  const key = (data.key as Record<string, unknown>) || {};
  const remoteJid = String(key.remoteJid || key.remote_jid || '');
  if (!remoteJid) return null;

  const phone = normalizePhone(remoteJid);
  const message = (data.message as Record<string, unknown>) || {};
  const messageType = String(data.messageType || root.messageType || '').toLowerCase();

  const btn =
    (message.buttonsResponseMessage as Record<string, unknown>) ||
    (message.templateButtonReplyMessage as Record<string, unknown>);
  if (btn?.selectedButtonId || btn?.selectedId) {
    return {
      phone,
      kind: 'interactive',
      buttonId: String(btn.selectedButtonId || btn.selectedId),
      rawPreview: `[button:${btn.selectedButtonId || btn.selectedId}]`,
    };
  }

  const list = message.listResponseMessage as Record<string, unknown>;
  const listReply = list?.singleSelectReply as Record<string, unknown>;
  if (listReply?.selectedRowId) {
    return {
      phone,
      kind: 'interactive',
      buttonId: String(listReply.selectedRowId),
      rawPreview: `[list:${listReply.selectedRowId}]`,
    };
  }

  const loc = message.locationMessage as Record<string, unknown>;
  if (loc?.degreesLatitude != null && loc?.degreesLongitude != null) {
    return {
      phone,
      kind: 'location',
      latitude: Number(loc.degreesLatitude),
      longitude: Number(loc.degreesLongitude),
      rawPreview: `[location:${loc.degreesLatitude},${loc.degreesLongitude}]`,
    };
  }

  if (message.conversation) {
    return { phone, kind: 'text', text: String(message.conversation), rawPreview: String(message.conversation) };
  }
  if (message.extendedTextMessage) {
    const ext = message.extendedTextMessage as Record<string, unknown>;
    return { phone, kind: 'text', text: String(ext.text || ''), rawPreview: String(ext.text || '') };
  }
  if (message.imageMessage || messageType.includes('image')) {
    const img = (message.imageMessage as Record<string, unknown>) || {};
    return {
      phone,
      kind: 'image',
      caption: img.caption ? String(img.caption) : undefined,
      mediaMessage: data,
      rawPreview: img.caption ? String(img.caption) : '[image]',
    };
  }
  if (message.audioMessage || message.pttMessage || messageType.includes('audio')) {
    return { phone, kind: 'audio', mediaMessage: data, rawPreview: '[voice note]' };
  }

  return { phone, kind: 'unknown', rawPreview: '[unsupported message]' };
}

function featureKeyForKind(kind: MessageKind, intent?: string): string | null {
  if (kind === 'interactive' || kind === 'location') return null;
  if (kind === 'text' && intent === 'nhis') return 'wa_nhis';
  if (kind === 'text' && intent === 'diet') return 'wa_diet';
  if (kind === 'text' && intent === 'facility') return 'wa_facility';
  if (kind === 'text') return 'wa_text';
  if (kind === 'audio') return 'wa_audio';
  if (kind === 'image') return 'wa_image';
  return null;
}

function transactionFooter(featureKey: string, charged: number, balance: number): string {
  return `\n\n—\n📊 ${featureKey} · −${charged} pts · Balance: ${balance}`;
}

async function handleImageFlow(
  deps: WhatsAppDeps,
  config: WhatsAppConfig,
  phone: string,
  userId: string,
  apiKey: string,
  parsed: ParsedMessage
): Promise<{ reply: string; featureKey: string; skipFooter?: boolean }> {
  const media = await fetchMediaBase64(config, parsed.mediaMessage);
  if (!media.base64) throw new Error(media.error || 'Could not download image');

  const extract = await extractPrescriptionFromImage(apiKey, media.base64, media.mimetype || 'image/jpeg', parsed.caption);

  if (extract.isLabReport) {
    const sessionId = saveSession(deps, {
      userId,
      phone,
      sessionType: 'lab_result',
      payload: { summary: extract.summary || '' },
      ttlMinutes: 120,
    });
    await sendLabFollowUpButtons(config, phone, sessionId, extract.summary || 'Lab report received.');
    return { reply: extract.summary || 'Lab report analyzed.', featureKey: 'wa_image', skipFooter: true };
  }

  if (extract.isPrescription || extract.medicationName) {
    await offerReminderSetup(deps, config, phone, userId, extract);
    if (extract.deliveryMedications?.length) {
      await offerDelivery(deps, config, phone, userId, extract.deliveryMedications);
    }
    return {
      reply: extract.summary || `${extract.medicationName}: ${extract.dosageInstructions}`,
      featureKey: 'wa_image',
      skipFooter: true,
    };
  }

  const reply = await analyzeLabOrMedicineImage(
    apiKey,
    config.systemPrompt,
    media.base64,
    media.mimetype || 'image/jpeg',
    parsed.caption
  );
  return { reply, featureKey: 'wa_image' };
}

export async function processIncomingMessage(
  deps: WhatsAppDeps,
  config: WhatsAppConfig,
  parsed: ParsedMessage
): Promise<void> {
  const phone = parsed.phone;
  const apiKey = deps.getGeminiApiKey() || process.env.GEMINI_API_KEY || '';

  if (!config.enabled) {
    await sendTextMessage(config, phone, 'eHealth AI WhatsApp is temporarily unavailable.');
    return;
  }

  const user = findUserByPhone(deps, phone);
  if (!user) {
    await sendTextMessage(config, phone, 'Register at ehealthaigh.com and link your WhatsApp number in Account settings.');
    return;
  }

  if (!user.is_active) {
    await sendTextMessage(config, phone, 'Your account is disabled.');
    return;
  }

  if (parsed.kind === 'interactive' && parsed.buttonId) {
    const handled = await handleButtonOrListReply(deps, config, phone, user.id, parsed.buttonId, apiKey);
    insertWhatsAppLog(deps, {
      userId: user.id,
      phone,
      messageType: 'interactive',
      featureKey: null,
      pointsCharged: 0,
      status: handled ? 'success' : 'unknown_button',
      payloadPreview: preview(parsed.rawPreview),
      responsePreview: null,
    });
    return;
  }

  if (parsed.kind === 'location' && parsed.latitude != null && parsed.longitude != null) {
    if (user.points_balance <= 0) {
      await sendTextMessage(config, phone, '⚠️ Insufficient points for facility lookup.');
      return;
    }
    try {
      const reply = await handleLocationShare(deps, config, phone, user.id, parsed.latitude, parsed.longitude);
      const deduct = deps.deductPoints(user.id, 'wa_facility', 'WhatsApp location lookup');
      await sendTextMessage(config, phone, `${reply}${transactionFooter('wa_facility', deduct.charged, deduct.balance)}`);
      insertWhatsAppLog(deps, {
        userId: user.id,
        phone,
        messageType: 'location',
        featureKey: 'wa_facility',
        pointsCharged: deduct.charged,
        status: 'success',
        payloadPreview: preview(parsed.rawPreview),
        responsePreview: preview(reply),
      });
    } catch (err) {
      console.error('[whatsapp] location error:', err);
      await sendTextMessage(config, phone, 'Could not find nearby facilities. Try again.');
    }
    return;
  }

  if (user.points_balance <= 0) {
    await sendTextMessage(config, phone, '⚠️ Insufficient points. Top up at ehealthaigh.com');
    return;
  }

  if (!apiKey && parsed.kind !== 'unknown') {
    await sendTextMessage(config, phone, 'AI service not configured.');
    return;
  }

  const intent = parsed.text ? detectIntent(parsed.text) : 'general';
  const featureKey = featureKeyForKind(parsed.kind, intent);

  if (parsed.kind === 'unknown') {
    await sendTextMessage(config, phone, 'Send text, voice, photo, or share location 📍. Reply *menu* for options.');
    return;
  }

  if (!featureKey) {
    await sendTextMessage(config, phone, 'Send text, voice, photo, or share location 📍');
    return;
  }

  try {
    let reply = '';
    let skipFooter = false;

    if (parsed.kind === 'text' && parsed.text) {
      const text = parsed.text.trim();

      if (intent === 'menu') {
        reply = MENU_TEXT;
      } else if (intent === 'family') {
        const add = parseFamilyAddCommand(text);
        if (add) {
          createFamilyProfile(deps, user.id, add.name, add.relationship);
          reply = `✅ Added family profile: *${add.name}*`;
        } else {
          reply = formatFamilyList(listFamilyProfiles(deps, user.id));
          const familyNotes = getUpcomingFamilyReminders(deps, user.id);
          if (familyNotes.length) reply += `\n\n${familyNotes.join('\n')}`;
        }
      } else if (intent === 'bp_log') {
        reply = logBloodPressure(deps, user.id, text) || 'Use format: BP: 120/80';
        skipFooter = true;
      } else if (intent === 'nhis') {
        reply = await answerNhisQuestion(apiKey, text);
      } else if (intent === 'diet') {
        reply = await answerDietQuestion(apiKey, text);
      } else if (intent === 'facility') {
        await promptFacilityType(config, phone);
        reply = 'Pick a facility type above, then share your location 📍';
        skipFooter = true;
      } else {
        const history = conversationHistory.get(normalizePhone(phone)) || [];
        reply = await analyzeText(apiKey, config.systemPrompt, text, history);
        pushHistory(phone, `User: ${text}`);
        pushHistory(phone, `Agyenim: ${reply.slice(0, 200)}`);
      }
    } else if (parsed.kind === 'audio' && parsed.mediaMessage) {
      const media = await fetchMediaBase64(config, parsed.mediaMessage);
      if (!media.base64) throw new Error(media.error || 'Could not download audio');
      reply = await analyzeAudio(apiKey, config.systemPrompt, media.base64, media.mimetype || 'audio/ogg');
    } else if (parsed.kind === 'image' && parsed.mediaMessage) {
      const result = await handleImageFlow(deps, config, phone, user.id, apiKey, parsed);
      reply = result.reply;
      skipFooter = !!result.skipFooter;
    } else {
      throw new Error('Unsupported payload');
    }

    const chargeKey = intent === 'nhis' ? 'wa_nhis' : intent === 'diet' ? 'wa_diet' : featureKey;
    const deduct = deps.deductPoints(user.id, chargeKey, `WhatsApp ${parsed.kind}`);

    if (parsed.kind === 'text' && intent === 'facility') {
      // list message already sent
    } else if (skipFooter) {
      await sendTextMessage(
        config,
        phone,
        `${reply}${transactionFooter(chargeKey, deduct.charged, deduct.balance)}`
      );
    } else {
      await sendTextMessage(config, phone, `${reply}${transactionFooter(chargeKey, deduct.charged, deduct.balance)}`);
    }

    insertWhatsAppLog(deps, {
      userId: user.id,
      phone,
      messageType: parsed.kind,
      featureKey: chargeKey,
      pointsCharged: deduct.charged,
      status: 'success',
      payloadPreview: preview(parsed.rawPreview),
      responsePreview: preview(reply),
    });
  } catch (err: unknown) {
    console.error('[whatsapp] process error:', err);
    await sendTextMessage(config, phone, 'Sorry, something went wrong. Please try again.').catch(() => undefined);
  }
}

export async function broadcastMessage(
  deps: WhatsAppDeps,
  config: WhatsAppConfig,
  text: string
): Promise<{ sent: number; failed: number; total: number }> {
  const phones = deps
    .getDb()
    .prepare(`SELECT phone FROM users WHERE phone IS NOT NULL AND phone != '' AND is_active = 1`)
    .all() as Array<{ phone: string }>;

  let sent = 0;
  let failed = 0;
  for (const row of phones) {
    const phone = String(row.phone).replace(/\D/g, '');
    if (!phone) continue;
    const result = await sendTextMessage(config, phone, text);
    if (result.ok) sent += 1;
    else failed += 1;
  }
  return { sent, failed, total: phones.length };
}
