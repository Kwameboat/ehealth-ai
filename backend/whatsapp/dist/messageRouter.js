"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseEvolutionPayload = parseEvolutionPayload;
exports.processIncomingMessage = processIncomingMessage;
exports.broadcastMessage = broadcastMessage;
const gemini_1 = require("./gemini");
const evolution_1 = require("./evolution");
const buttonHandler_1 = require("./buttonHandler");
const logs_1 = require("./logs");
const phone_1 = require("./phone");
const intents_1 = require("./intents");
const sessionStore_1 = require("./sessionStore");
const medication_1 = require("./features/medication");
const healthFeatures_1 = require("./features/healthFeatures");
const family_1 = require("./features/family");
const facilities_1 = require("./features/facilities");
const conversationHistory = new Map();
function pushHistory(phone, line) {
    const key = (0, phone_1.normalizePhone)(phone);
    const list = conversationHistory.get(key) || [];
    list.push(line);
    if (list.length > 12)
        list.splice(0, list.length - 12);
    conversationHistory.set(key, list);
}
function parseEvolutionPayload(body) {
    if (!body || typeof body !== 'object')
        return null;
    const root = body;
    const data = root.data || root;
    const key = data.key || {};
    const remoteJid = String(key.remoteJid || key.remote_jid || '');
    if (!remoteJid)
        return null;
    const phone = (0, phone_1.normalizePhone)(remoteJid);
    const message = data.message || {};
    const messageType = String(data.messageType || root.messageType || '').toLowerCase();
    const btn = message.buttonsResponseMessage ||
        message.templateButtonReplyMessage;
    if (btn?.selectedButtonId || btn?.selectedId) {
        return {
            phone,
            kind: 'interactive',
            buttonId: String(btn.selectedButtonId || btn.selectedId),
            rawPreview: `[button:${btn.selectedButtonId || btn.selectedId}]`,
        };
    }
    const list = message.listResponseMessage;
    const listReply = list?.singleSelectReply;
    if (listReply?.selectedRowId) {
        return {
            phone,
            kind: 'interactive',
            buttonId: String(listReply.selectedRowId),
            rawPreview: `[list:${listReply.selectedRowId}]`,
        };
    }
    const loc = message.locationMessage;
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
        const ext = message.extendedTextMessage;
        return { phone, kind: 'text', text: String(ext.text || ''), rawPreview: String(ext.text || '') };
    }
    if (message.imageMessage || messageType.includes('image')) {
        const img = message.imageMessage || {};
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
function featureKeyForKind(kind, intent) {
    if (kind === 'interactive' || kind === 'location')
        return null;
    if (kind === 'text' && intent === 'nhis')
        return 'wa_nhis';
    if (kind === 'text' && intent === 'diet')
        return 'wa_diet';
    if (kind === 'text' && intent === 'facility')
        return 'wa_facility';
    if (kind === 'text')
        return 'wa_text';
    if (kind === 'audio')
        return 'wa_audio';
    if (kind === 'image')
        return 'wa_image';
    return null;
}
function transactionFooter(featureKey, charged, balance) {
    return `\n\n—\n📊 ${featureKey} · −${charged} pts · Balance: ${balance}`;
}
async function handleImageFlow(deps, config, phone, userId, apiKey, parsed) {
    const media = await (0, evolution_1.fetchMediaBase64)(config, parsed.mediaMessage);
    if (!media.base64)
        throw new Error(media.error || 'Could not download image');
    const extract = await (0, gemini_1.extractPrescriptionFromImage)(apiKey, media.base64, media.mimetype || 'image/jpeg', parsed.caption);
    if (extract.isLabReport) {
        const sessionId = (0, sessionStore_1.saveSession)(deps, {
            userId,
            phone,
            sessionType: 'lab_result',
            payload: { summary: extract.summary || '' },
            ttlMinutes: 120,
        });
        await (0, healthFeatures_1.sendLabFollowUpButtons)(config, phone, sessionId, extract.summary || 'Lab report received.');
        return { reply: extract.summary || 'Lab report analyzed.', featureKey: 'wa_image', skipFooter: true };
    }
    if (extract.isPrescription || extract.medicationName) {
        await (0, medication_1.offerReminderSetup)(deps, config, phone, userId, extract);
        if (extract.deliveryMedications?.length) {
            await (0, healthFeatures_1.offerDelivery)(deps, config, phone, userId, extract.deliveryMedications);
        }
        return {
            reply: extract.summary || `${extract.medicationName}: ${extract.dosageInstructions}`,
            featureKey: 'wa_image',
            skipFooter: true,
        };
    }
    const reply = await (0, gemini_1.analyzeLabOrMedicineImage)(apiKey, config.systemPrompt, media.base64, media.mimetype || 'image/jpeg', parsed.caption);
    return { reply, featureKey: 'wa_image' };
}
async function processIncomingMessage(deps, config, parsed) {
    const phone = parsed.phone;
    const apiKey = deps.getGeminiApiKey() || process.env.GEMINI_API_KEY || '';
    if (!config.enabled) {
        await (0, evolution_1.sendTextMessage)(config, phone, 'eHealth AI WhatsApp is temporarily unavailable.');
        return;
    }
    const user = (0, logs_1.findUserByPhone)(deps, phone);
    if (!user) {
        await (0, evolution_1.sendTextMessage)(config, phone, 'Register at ehealthaigh.com and link your WhatsApp number in Account settings.');
        return;
    }
    if (!user.is_active) {
        await (0, evolution_1.sendTextMessage)(config, phone, 'Your account is disabled.');
        return;
    }
    if (parsed.kind === 'interactive' && parsed.buttonId) {
        const handled = await (0, buttonHandler_1.handleButtonOrListReply)(deps, config, phone, user.id, parsed.buttonId, apiKey);
        (0, logs_1.insertWhatsAppLog)(deps, {
            userId: user.id,
            phone,
            messageType: 'interactive',
            featureKey: null,
            pointsCharged: 0,
            status: handled ? 'success' : 'unknown_button',
            payloadPreview: (0, logs_1.preview)(parsed.rawPreview),
            responsePreview: null,
        });
        return;
    }
    if (parsed.kind === 'location' && parsed.latitude != null && parsed.longitude != null) {
        if (user.points_balance <= 0) {
            await (0, evolution_1.sendTextMessage)(config, phone, '⚠️ Insufficient points for facility lookup.');
            return;
        }
        try {
            const reply = await (0, facilities_1.handleLocationShare)(deps, config, phone, user.id, parsed.latitude, parsed.longitude);
            const deduct = deps.deductPoints(user.id, 'wa_facility', 'WhatsApp location lookup');
            await (0, evolution_1.sendTextMessage)(config, phone, `${reply}${transactionFooter('wa_facility', deduct.charged, deduct.balance)}`);
            (0, logs_1.insertWhatsAppLog)(deps, {
                userId: user.id,
                phone,
                messageType: 'location',
                featureKey: 'wa_facility',
                pointsCharged: deduct.charged,
                status: 'success',
                payloadPreview: (0, logs_1.preview)(parsed.rawPreview),
                responsePreview: (0, logs_1.preview)(reply),
            });
        }
        catch (err) {
            console.error('[whatsapp] location error:', err);
            await (0, evolution_1.sendTextMessage)(config, phone, 'Could not find nearby facilities. Try again.');
        }
        return;
    }
    if (user.points_balance <= 0) {
        await (0, evolution_1.sendTextMessage)(config, phone, '⚠️ Insufficient points. Top up at ehealthaigh.com');
        return;
    }
    if (!apiKey && parsed.kind !== 'unknown') {
        await (0, evolution_1.sendTextMessage)(config, phone, 'AI service not configured.');
        return;
    }
    const intent = parsed.text ? (0, intents_1.detectIntent)(parsed.text) : 'general';
    const featureKey = featureKeyForKind(parsed.kind, intent);
    if (parsed.kind === 'unknown') {
        await (0, evolution_1.sendTextMessage)(config, phone, 'Send text, voice, photo, or share location 📍. Reply *menu* for options.');
        return;
    }
    if (!featureKey) {
        await (0, evolution_1.sendTextMessage)(config, phone, 'Send text, voice, photo, or share location 📍');
        return;
    }
    try {
        let reply = '';
        let skipFooter = false;
        if (parsed.kind === 'text' && parsed.text) {
            const text = parsed.text.trim();
            if (intent === 'menu') {
                reply = intents_1.MENU_TEXT;
            }
            else if (intent === 'family') {
                const add = (0, family_1.parseFamilyAddCommand)(text);
                if (add) {
                    (0, family_1.createFamilyProfile)(deps, user.id, add.name, add.relationship);
                    reply = `✅ Added family profile: *${add.name}*`;
                }
                else {
                    reply = (0, family_1.formatFamilyList)((0, family_1.listFamilyProfiles)(deps, user.id));
                    const familyNotes = (0, family_1.getUpcomingFamilyReminders)(deps, user.id);
                    if (familyNotes.length)
                        reply += `\n\n${familyNotes.join('\n')}`;
                }
            }
            else if (intent === 'bp_log') {
                reply = (0, healthFeatures_1.logBloodPressure)(deps, user.id, text) || 'Use format: BP: 120/80';
                skipFooter = true;
            }
            else if (intent === 'nhis') {
                reply = await (0, healthFeatures_1.answerNhisQuestion)(apiKey, text);
            }
            else if (intent === 'diet') {
                reply = await (0, healthFeatures_1.answerDietQuestion)(apiKey, text);
            }
            else if (intent === 'facility') {
                await (0, facilities_1.promptFacilityType)(config, phone);
                reply = 'Pick a facility type above, then share your location 📍';
                skipFooter = true;
            }
            else {
                const history = conversationHistory.get((0, phone_1.normalizePhone)(phone)) || [];
                reply = await (0, gemini_1.analyzeText)(apiKey, config.systemPrompt, text, history);
                pushHistory(phone, `User: ${text}`);
                pushHistory(phone, `Agyenim: ${reply.slice(0, 200)}`);
            }
        }
        else if (parsed.kind === 'audio' && parsed.mediaMessage) {
            const media = await (0, evolution_1.fetchMediaBase64)(config, parsed.mediaMessage);
            if (!media.base64)
                throw new Error(media.error || 'Could not download audio');
            reply = await (0, gemini_1.analyzeAudio)(apiKey, config.systemPrompt, media.base64, media.mimetype || 'audio/ogg');
        }
        else if (parsed.kind === 'image' && parsed.mediaMessage) {
            const result = await handleImageFlow(deps, config, phone, user.id, apiKey, parsed);
            reply = result.reply;
            skipFooter = !!result.skipFooter;
        }
        else {
            throw new Error('Unsupported payload');
        }
        const chargeKey = intent === 'nhis' ? 'wa_nhis' : intent === 'diet' ? 'wa_diet' : featureKey;
        const deduct = deps.deductPoints(user.id, chargeKey, `WhatsApp ${parsed.kind}`);
        if (parsed.kind === 'text' && intent === 'facility') {
            // list message already sent
        }
        else if (skipFooter) {
            await (0, evolution_1.sendTextMessage)(config, phone, `${reply}${transactionFooter(chargeKey, deduct.charged, deduct.balance)}`);
        }
        else {
            await (0, evolution_1.sendTextMessage)(config, phone, `${reply}${transactionFooter(chargeKey, deduct.charged, deduct.balance)}`);
        }
        (0, logs_1.insertWhatsAppLog)(deps, {
            userId: user.id,
            phone,
            messageType: parsed.kind,
            featureKey: chargeKey,
            pointsCharged: deduct.charged,
            status: 'success',
            payloadPreview: (0, logs_1.preview)(parsed.rawPreview),
            responsePreview: (0, logs_1.preview)(reply),
        });
    }
    catch (err) {
        console.error('[whatsapp] process error:', err);
        await (0, evolution_1.sendTextMessage)(config, phone, 'Sorry, something went wrong. Please try again.').catch(() => undefined);
    }
}
async function broadcastMessage(deps, config, text) {
    const phones = deps
        .getDb()
        .prepare(`SELECT phone FROM users WHERE phone IS NOT NULL AND phone != '' AND is_active = 1`)
        .all();
    let sent = 0;
    let failed = 0;
    for (const row of phones) {
        const phone = String(row.phone).replace(/\D/g, '');
        if (!phone)
            continue;
        const result = await (0, evolution_1.sendTextMessage)(config, phone, text);
        if (result.ok)
            sent += 1;
        else
            failed += 1;
    }
    return { sent, failed, total: phones.length };
}
