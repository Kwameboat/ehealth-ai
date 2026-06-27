"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseEvolutionPayload = parseEvolutionPayload;
exports.processIncomingMessage = processIncomingMessage;
exports.broadcastMessage = broadcastMessage;
const gemini_1 = require("./gemini");
const evolution_1 = require("./evolution");
const logs_1 = require("./logs");
const phone_1 = require("./phone");
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
        return {
            phone,
            kind: 'audio',
            mediaMessage: data,
            rawPreview: '[voice note]',
        };
    }
    const textKeys = ['text', 'body'];
    for (const k of textKeys) {
        if (typeof data[k] === 'string' && data[k]) {
            return { phone, kind: 'text', text: String(data[k]), rawPreview: String(data[k]) };
        }
    }
    return { phone, kind: 'unknown', rawPreview: '[unsupported message]' };
}
function featureKeyForKind(kind) {
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
async function processIncomingMessage(deps, config, parsed) {
    const phone = parsed.phone;
    const apiKey = deps.getGeminiApiKey() || process.env.GEMINI_API_KEY || '';
    if (!config.enabled) {
        await (0, evolution_1.sendTextMessage)(config, phone, 'eHealth AI WhatsApp is temporarily unavailable. Please use the app at ehealthaigh.com');
        (0, logs_1.insertWhatsAppLog)(deps, {
            userId: null,
            phone,
            messageType: parsed.kind,
            featureKey: null,
            pointsCharged: 0,
            status: 'disabled',
            payloadPreview: (0, logs_1.preview)(parsed.rawPreview),
            responsePreview: null,
        });
        return;
    }
    const user = (0, logs_1.findUserByPhone)(deps, phone);
    if (!user) {
        const msg = 'Welcome to eHealth AI (Agyenim). Your number is not linked yet. Register at ehealthaigh.com and add your WhatsApp number in Account settings.';
        await (0, evolution_1.sendTextMessage)(config, phone, msg);
        (0, logs_1.insertWhatsAppLog)(deps, {
            userId: null,
            phone,
            messageType: parsed.kind,
            featureKey: null,
            pointsCharged: 0,
            status: 'unregistered',
            payloadPreview: (0, logs_1.preview)(parsed.rawPreview),
            responsePreview: (0, logs_1.preview)(msg),
        });
        return;
    }
    if (!user.is_active) {
        const msg = 'Your eHealth AI account is disabled. Contact support.';
        await (0, evolution_1.sendTextMessage)(config, phone, msg);
        (0, logs_1.insertWhatsAppLog)(deps, {
            userId: user.id,
            phone,
            messageType: parsed.kind,
            featureKey: null,
            pointsCharged: 0,
            status: 'account_disabled',
            payloadPreview: (0, logs_1.preview)(parsed.rawPreview),
            responsePreview: (0, logs_1.preview)(msg),
        });
        return;
    }
    const balance = user.points_balance;
    if (balance <= 0) {
        const msg = '⚠️ Insufficient points. Top up at ehealthaigh.com to continue chatting with Agyenim on WhatsApp.';
        await (0, evolution_1.sendTextMessage)(config, phone, msg);
        (0, logs_1.insertWhatsAppLog)(deps, {
            userId: user.id,
            phone,
            messageType: parsed.kind,
            featureKey: null,
            pointsCharged: 0,
            status: 'insufficient_points',
            payloadPreview: (0, logs_1.preview)(parsed.rawPreview),
            responsePreview: (0, logs_1.preview)(msg),
        });
        return;
    }
    const featureKey = featureKeyForKind(parsed.kind);
    if (!featureKey) {
        const msg = 'Send text, a voice note, or a lab/medicine photo for Agyenim to analyze.';
        await (0, evolution_1.sendTextMessage)(config, phone, msg);
        (0, logs_1.insertWhatsAppLog)(deps, {
            userId: user.id,
            phone,
            messageType: parsed.kind,
            featureKey: null,
            pointsCharged: 0,
            status: 'unsupported',
            payloadPreview: (0, logs_1.preview)(parsed.rawPreview),
            responsePreview: (0, logs_1.preview)(msg),
        });
        return;
    }
    if (!apiKey) {
        const msg = 'AI service is not configured. Please try again later.';
        await (0, evolution_1.sendTextMessage)(config, phone, msg);
        (0, logs_1.insertWhatsAppLog)(deps, {
            userId: user.id,
            phone,
            messageType: parsed.kind,
            featureKey,
            pointsCharged: 0,
            status: 'ai_not_configured',
            payloadPreview: (0, logs_1.preview)(parsed.rawPreview),
            responsePreview: (0, logs_1.preview)(msg),
        });
        return;
    }
    try {
        let reply = '';
        if (parsed.kind === 'text' && parsed.text) {
            const history = conversationHistory.get((0, phone_1.normalizePhone)(phone)) || [];
            reply = await (0, gemini_1.analyzeText)(apiKey, config.systemPrompt, parsed.text, history);
            pushHistory(phone, `User: ${parsed.text}`);
            pushHistory(phone, `Agyenim: ${reply.slice(0, 200)}`);
        }
        else if (parsed.kind === 'audio' && parsed.mediaMessage) {
            const media = await (0, evolution_1.fetchMediaBase64)(config, parsed.mediaMessage);
            if (!media.base64)
                throw new Error(media.error || 'Could not download audio');
            reply = await (0, gemini_1.analyzeAudio)(apiKey, config.systemPrompt, media.base64, media.mimetype || 'audio/ogg');
        }
        else if (parsed.kind === 'image' && parsed.mediaMessage) {
            const media = await (0, evolution_1.fetchMediaBase64)(config, parsed.mediaMessage);
            if (!media.base64)
                throw new Error(media.error || 'Could not download image');
            reply = await (0, gemini_1.analyzeLabOrMedicineImage)(apiKey, config.systemPrompt, media.base64, media.mimetype || 'image/jpeg', parsed.caption);
        }
        else {
            throw new Error('Unsupported payload');
        }
        const deduct = deps.deductPoints(user.id, featureKey, `WhatsApp ${parsed.kind}`);
        const footer = transactionFooter(featureKey, deduct.charged, deduct.balance);
        const outbound = `${reply}${footer}`;
        await (0, evolution_1.sendTextMessage)(config, phone, outbound);
        (0, logs_1.insertWhatsAppLog)(deps, {
            userId: user.id,
            phone,
            messageType: parsed.kind,
            featureKey,
            pointsCharged: deduct.charged,
            status: 'success',
            payloadPreview: (0, logs_1.preview)(parsed.rawPreview),
            responsePreview: (0, logs_1.preview)(reply),
        });
    }
    catch (err) {
        const isPoints = err &&
            typeof err === 'object' &&
            'code' in err &&
            err.code === 'INSUFFICIENT_POINTS';
        const msg = isPoints
            ? '⚠️ Insufficient points for this request. Top up at ehealthaigh.com'
            : 'Sorry, something went wrong processing your message. Please try again.';
        await (0, evolution_1.sendTextMessage)(config, phone, msg).catch(() => undefined);
        (0, logs_1.insertWhatsAppLog)(deps, {
            userId: user.id,
            phone,
            messageType: parsed.kind,
            featureKey,
            pointsCharged: 0,
            status: isPoints ? 'insufficient_points' : 'error',
            payloadPreview: (0, logs_1.preview)(parsed.rawPreview),
            responsePreview: (0, logs_1.preview)(msg),
        });
        console.error('[whatsapp] process error:', err);
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
        (0, logs_1.insertWhatsAppLog)(deps, {
            userId: null,
            phone,
            messageType: 'broadcast',
            featureKey: null,
            pointsCharged: 0,
            status: result.ok ? 'broadcast_sent' : 'broadcast_failed',
            payloadPreview: (0, logs_1.preview)(text),
            responsePreview: result.error || null,
        });
    }
    return { sent, failed, total: phones.length };
}
