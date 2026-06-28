"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchInstanceInfo = fetchInstanceInfo;
exports.createEvolutionInstance = createEvolutionInstance;
exports.connectEvolutionInstance = connectEvolutionInstance;
exports.fetchEvolutionQrWithRetry = fetchEvolutionQrWithRetry;
exports.fetchEvolutionPairingWithRetry = fetchEvolutionPairingWithRetry;
exports.logoutEvolutionInstance = logoutEvolutionInstance;
exports.fetchConnectionState = fetchConnectionState;
exports.findEvolutionWebhook = findEvolutionWebhook;
exports.setEvolutionWebhook = setEvolutionWebhook;
exports.sendTextMessage = sendTextMessage;
exports.fetchMediaBase64 = fetchMediaBase64;
const httpClient_1 = require("./httpClient");
const phone_1 = require("./phone");
function requireEvolutionConfig(config) {
    if (!config.baseUrl || !config.apiKey || !config.instanceName) {
        return 'Evolution API URL, key, or instance name not configured';
    }
    return null;
}
function extractPhoneFromJid(jid) {
    if (!jid || typeof jid !== 'string')
        return undefined;
    const digits = jid.split('@')[0]?.replace(/\D/g, '');
    return digits || undefined;
}
function unwrapEvolutionPayload(data) {
    const nested = data.data;
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
        return { ...data, ...nested };
    }
    const response = data.response;
    if (response && typeof response === 'object' && !Array.isArray(response)) {
        return { ...data, ...response };
    }
    return data;
}
function looksLikePairingCode(value) {
    const v = value.trim();
    if (/^[A-Z0-9]{4}-[A-Z0-9]{4}$/i.test(v))
        return true;
    const clean = v.replace(/\W/g, '');
    if (/^[A-Z0-9]{8}$/i.test(clean))
        return true;
    if (/^\d{8}$/.test(clean))
        return true;
    return false;
}
function formatPairingCode(value) {
    const clean = value.replace(/\W/g, '').toUpperCase();
    if (clean.length === 8)
        return `${clean.slice(0, 4)}-${clean.slice(4)}`;
    return value.trim().toUpperCase();
}
function asPairingString(value) {
    if (value === null || value === undefined)
        return undefined;
    if (typeof value === 'number' && Number.isFinite(value)) {
        return formatPairingCode(String(Math.trunc(value)).padStart(8, '0'));
    }
    if (typeof value === 'string' && looksLikePairingCode(value)) {
        return formatPairingCode(value);
    }
    return undefined;
}
function extractPairingCode(root, qrcode) {
    const candidates = [
        root.pairingCode,
        root.linkCode,
        root.pairing_code,
        root.pin,
        root.connectionCode,
        typeof qrcode === 'object' && qrcode ? qrcode.pairingCode : undefined,
        typeof qrcode === 'object' && qrcode ? qrcode.linkCode : undefined,
        typeof qrcode === 'object' && qrcode ? qrcode.code : undefined,
    ];
    if (typeof root.code === 'string' && looksLikePairingCode(root.code)) {
        candidates.push(root.code);
    }
    for (const c of candidates) {
        const formatted = asPairingString(c);
        if (formatted)
            return formatted;
    }
    return undefined;
}
function deepFindPairingCode(value, depth = 0) {
    if (depth > 8 || value === null || value === undefined)
        return undefined;
    if (typeof value === 'string' || typeof value === 'number') {
        return asPairingString(value);
    }
    if (Array.isArray(value)) {
        for (const item of value) {
            const found = deepFindPairingCode(item, depth + 1);
            if (found)
                return found;
        }
        return undefined;
    }
    if (typeof value === 'object') {
        const obj = value;
        for (const [key, val] of Object.entries(obj)) {
            if (/pair|link|pin|code/i.test(key)) {
                const formatted = asPairingString(val);
                if (formatted)
                    return formatted;
            }
        }
        for (const val of Object.values(obj)) {
            const found = deepFindPairingCode(val, depth + 1);
            if (found)
                return found;
        }
    }
    return undefined;
}
function looksLikeWhatsAppQrCode(value) {
    return value.startsWith('2@') || value.length > 40;
}
async function qrDataUrlFromCode(rawCode) {
    try {
        // Lazy load — optional on cPanel when install-backend-deps.sh omits qrcode
        const QRCode = require('qrcode');
        return await QRCode.toDataURL(rawCode, { width: 280, margin: 1 });
    }
    catch {
        return undefined;
    }
}
async function parseConnectPayload(data) {
    const root = unwrapEvolutionPayload(data);
    const qrcode = root.qrcode;
    const instance = root.instance;
    let base64 = (typeof root.base64 === 'string' && root.base64) ||
        (typeof root.base64Image === 'string' && root.base64Image) ||
        (typeof qrcode === 'object' && qrcode && typeof qrcode.base64 === 'string' && qrcode.base64) ||
        (typeof qrcode === 'object' && qrcode && typeof qrcode.base64Image === 'string' && qrcode.base64Image) ||
        (typeof root.qr === 'string' && root.qr) ||
        undefined;
    const rawCode = (typeof root.code === 'string' && looksLikeWhatsAppQrCode(root.code) && root.code) ||
        (typeof qrcode === 'object' && qrcode && typeof qrcode.code === 'string' && qrcode.code) ||
        (typeof qrcode === 'string' && qrcode) ||
        undefined;
    if (!base64 && rawCode) {
        base64 = await qrDataUrlFromCode(rawCode);
    }
    const pairingCode = extractPairingCode(root, qrcode) || deepFindPairingCode(root);
    const state = (typeof instance?.status === 'string' && instance.status) ||
        (typeof instance?.state === 'string' && instance.state) ||
        (typeof root.state === 'string' && root.state) ||
        undefined;
    return {
        qrBase64: base64 ? normalizeQrBase64(base64) : undefined,
        qrCode: rawCode,
        pairingCode,
        state,
    };
}
function normalizeQrBase64(value) {
    if (value.startsWith('data:image'))
        return value;
    return `data:image/png;base64,${value.replace(/^data:image\/[a-z]+;base64,/, '')}`;
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
async function requestEvolutionConnect(config, method, phone) {
    const digits = phone ? (0, phone_1.normalizePhone)(phone) : undefined;
    const path = `/instance/connect/${encodeURIComponent(config.instanceName)}`;
    if (method === 'GET') {
        const query = digits ? `?number=${encodeURIComponent(digits)}` : '';
        const res = await (0, httpClient_1.evolutionRequest)(config, `${path}${query}`);
        return res.ok ? { ok: true, data: res.data } : { ok: false, data: res.data, error: res.error };
    }
    const res = await (0, httpClient_1.evolutionRequest)(config, path, {
        method: 'POST',
        body: digits
            ? {
                number: digits,
                instanceName: config.instanceName,
                phoneNumber: digits,
            }
            : {},
    });
    return res.ok ? { ok: true, data: res.data } : { ok: false, data: res.data, error: res.error };
}
function hasQrPayload(parsed) {
    return !!(parsed.qrBase64 || parsed.qrCode || parsed.pairingCode);
}
function parseInstanceRow(row) {
    const instance = row.instance || row;
    const state = String(instance.status ||
        instance.state ||
        instance.connectionStatus ||
        row.status ||
        row.state ||
        '');
    const phone = extractPhoneFromJid(row.ownerJid) ||
        extractPhoneFromJid(instance.ownerJid) ||
        extractPhoneFromJid(row.number) ||
        extractPhoneFromJid(instance.number);
    const profileName = (typeof row.profileName === 'string' && row.profileName) ||
        (typeof instance.profileName === 'string' && instance.profileName) ||
        undefined;
    return { state: state || undefined, phone, profileName };
}
async function fetchInstanceInfo(config) {
    const missing = requireEvolutionConfig(config);
    if (missing)
        return { ok: false, error: missing };
    const res = await (0, httpClient_1.evolutionRequest)(config, `/instance/fetchInstances?instanceName=${encodeURIComponent(config.instanceName)}`);
    if (!res.ok) {
        const all = await (0, httpClient_1.evolutionRequest)(config, '/instance/fetchInstances');
        if (!all.ok)
            return { ok: false, error: res.error || all.error || 'Instance lookup failed' };
        const rows = Array.isArray(all.data) ? all.data : all.data.instances;
        const list = Array.isArray(rows) ? rows : [];
        const match = list.find((row) => {
            const inst = row.instance || row;
            return String(inst.instanceName || inst.name || '') === config.instanceName;
        });
        if (!match)
            return { ok: true, exists: false };
        const parsed = parseInstanceRow(match);
        return { ok: true, exists: true, ...parsed };
    }
    const rows = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data.instances)
            ? res.data.instances
            : res.data.instance
                ? [res.data]
                : [];
    const list = rows;
    if (!list.length)
        return { ok: true, exists: false };
    const parsed = parseInstanceRow(list[0]);
    return { ok: true, exists: true, ...parsed };
}
async function createEvolutionInstance(config, phone) {
    const missing = requireEvolutionConfig(config);
    if (missing)
        return { ok: false, error: missing };
    const digits = phone ? (0, phone_1.normalizePhone)(phone) : undefined;
    const res = await (0, httpClient_1.evolutionRequest)(config, '/instance/create', {
        method: 'POST',
        body: {
            instanceName: config.instanceName,
            integration: 'WHATSAPP-BAILEYS',
            qrcode: true,
            ...(digits ? { number: digits } : {}),
        },
    });
    if (!res.ok) {
        const msg = (res.error || '').toLowerCase();
        if (msg.includes('already') || msg.includes('exist')) {
            return connectEvolutionInstance(config, phone);
        }
        return { ok: false, error: res.error || 'Instance creation failed' };
    }
    const parsed = await parseConnectPayload(res.data);
    return { ok: true, created: true, ...parsed };
}
async function connectEvolutionInstance(config, phone) {
    const missing = requireEvolutionConfig(config);
    if (missing)
        return { ok: false, error: missing };
    let lastError;
    let best = {};
    for (const method of ['GET', 'POST']) {
        const res = await requestEvolutionConnect(config, method, phone);
        if (!res.ok) {
            lastError = res.error;
            continue;
        }
        const parsed = await parseConnectPayload(res.data);
        if (hasQrPayload(parsed))
            return { ok: true, ...parsed };
        best = parsed;
    }
    if (best.qrBase64 || best.qrCode || best.pairingCode || best.state) {
        return { ok: true, ...best };
    }
    return { ok: false, error: lastError || 'Connect failed — Evolution returned no QR code' };
}
async function fetchEvolutionQrWithRetry(config, phone, opts = {}) {
    const maxAttempts = opts.maxAttempts ?? 8;
    const delayMs = opts.delayMs ?? 1500;
    let lastError;
    let lastState;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        let result = await connectEvolutionInstance(config, phone);
        if (!result.ok && !phone) {
            const info = await fetchInstanceInfo(config);
            if (!info.exists) {
                const created = await createEvolutionInstance(config);
                if (created.ok) {
                    if (hasQrPayload(created))
                        return created;
                    result = created;
                }
                else {
                    lastError = created.error;
                }
            }
        }
        if (result.ok) {
            lastState = result.state;
            if (hasQrPayload(result))
                return result;
            lastError = result.error;
        }
        else {
            lastError = result.error;
        }
        if (phone)
            break;
        if (attempt < maxAttempts - 1)
            await sleep(delayMs);
    }
    return {
        ok: true,
        state: lastState || 'connecting',
        error: lastError || 'Evolution did not return a QR code — check API key and instance name',
    };
}
async function fetchEvolutionPairingWithRetry(config, phone, opts = {}) {
    const missing = requireEvolutionConfig(config);
    if (missing)
        return { ok: false, error: missing };
    const digits = (0, phone_1.normalizePhone)(phone);
    if (!digits || digits.length < 11) {
        return {
            ok: false,
            error: 'Enter a valid Ghana number (e.g. 0501234567 or 233501234567)',
        };
    }
    const maxAttempts = opts.maxAttempts ?? 8;
    const delayMs = opts.delayMs ?? 2000;
    let lastError;
    const conn = await fetchConnectionState(config);
    const connState = String(conn.state || 'close').toLowerCase();
    if (connState === 'connecting') {
        await logoutEvolutionInstance(config);
        await sleep(1500);
    }
    const info = await fetchInstanceInfo(config);
    if (!info.exists) {
        const created = await createEvolutionInstance(config, digits);
        if (created.ok && created.pairingCode) {
            return { ok: true, pairingCode: created.pairingCode, state: created.state, phone: digits };
        }
        if (!created.ok)
            lastError = created.error;
        await sleep(1000);
    }
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const method = attempt < 5 ? 'GET' : 'POST';
        const res = await requestEvolutionConnect(config, method, digits);
        if (res.ok) {
            const parsed = await parseConnectPayload(res.data);
            if (parsed.pairingCode) {
                return {
                    ok: true,
                    pairingCode: parsed.pairingCode,
                    qrBase64: parsed.qrBase64,
                    state: parsed.state,
                    phone: digits,
                };
            }
            lastError = `Evolution responded but no link code (attempt ${attempt + 1}/${maxAttempts})`;
        }
        else {
            lastError = res.error;
        }
        if (attempt === 2 && !info.exists) {
            const alt = await (0, httpClient_1.evolutionRequest)(config, '/instance/create', {
                method: 'POST',
                body: {
                    instanceName: config.instanceName,
                    integration: 'WHATSAPP-BAILEYS',
                    number: digits,
                    qrcode: false,
                },
            });
            if (alt.ok) {
                const parsed = await parseConnectPayload(alt.data);
                if (parsed.pairingCode) {
                    return { ok: true, pairingCode: parsed.pairingCode, state: parsed.state, phone: digits };
                }
            }
        }
        if (attempt < maxAttempts - 1)
            await sleep(delayMs);
    }
    return {
        ok: false,
        error: lastError ||
            'Could not get WhatsApp link code — confirm number is on WhatsApp and Evolution API key is correct',
    };
}
async function logoutEvolutionInstance(config) {
    const missing = requireEvolutionConfig(config);
    if (missing)
        return { ok: false, error: missing };
    const res = await (0, httpClient_1.evolutionRequest)(config, `/instance/logout/${encodeURIComponent(config.instanceName)}`, { method: 'DELETE' });
    if (!res.ok)
        return { ok: false, error: res.error || 'Logout failed' };
    return { ok: true };
}
async function fetchConnectionState(config) {
    const missing = requireEvolutionConfig(config);
    if (missing)
        return { ok: false, error: missing };
    const [stateRes, info] = await Promise.all([
        (0, httpClient_1.evolutionRequest)(config, `/instance/connectionState/${encodeURIComponent(config.instanceName)}`),
        fetchInstanceInfo(config),
    ]);
    if (!stateRes.ok) {
        return { ok: false, error: stateRes.error || 'Connection check failed' };
    }
    const instance = stateRes.data.instance;
    const state = String(instance?.state ||
        stateRes.data.state ||
        stateRes.data.connectionStatus ||
        info.state ||
        'unknown');
    return {
        ok: true,
        state,
        instance: config.instanceName,
        phone: info.phone,
        profileName: info.profileName,
    };
}
async function findEvolutionWebhook(config) {
    if (!config.baseUrl || !config.apiKey || !config.instanceName) {
        return { ok: false, error: 'Evolution API not configured' };
    }
    const res = await (0, httpClient_1.evolutionRequest)(config, `/webhook/find/${encodeURIComponent(config.instanceName)}`);
    if (!res.ok)
        return { ok: false, error: res.error || 'Webhook lookup failed' };
    const nested = res.data.webhook;
    const enabled = Boolean(res.data.enabled ?? nested?.enabled);
    const url = String(res.data.url ?? nested?.url ?? '');
    const events = (res.data.events ?? nested?.events);
    return { ok: true, enabled, url: url || undefined, events };
}
async function setEvolutionWebhook(config, webhookUrl) {
    if (!config.baseUrl || !config.apiKey || !config.instanceName) {
        return { ok: false, error: 'Evolution API not configured' };
    }
    const headers = {};
    if (config.webhookSecret) {
        headers['x-webhook-secret'] = config.webhookSecret;
    }
    const body = {
        enabled: true,
        url: webhookUrl,
        webhookByEvents: false,
        webhookBase64: true,
        events: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE'],
    };
    if (Object.keys(headers).length) {
        body.headers = headers;
    }
    const res = await (0, httpClient_1.evolutionRequest)(config, `/webhook/set/${encodeURIComponent(config.instanceName)}`, { method: 'POST', body });
    if (!res.ok) {
        const alt = await (0, httpClient_1.evolutionRequest)(config, `/webhook/set/${encodeURIComponent(config.instanceName)}`, {
            method: 'POST',
            body: {
                webhook: {
                    enabled: true,
                    url: webhookUrl,
                    byEvents: false,
                    base64: true,
                    headers,
                    events: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE'],
                },
            },
        });
        if (!alt.ok)
            return { ok: false, error: alt.error || res.error || 'Webhook registration failed' };
    }
    return { ok: true };
}
async function sendTextMessage(config, phone, text) {
    if (!config.instanceName) {
        return { ok: false, error: 'Evolution API not configured' };
    }
    const res = await (0, httpClient_1.evolutionRequest)(config, `/message/sendText/${encodeURIComponent(config.instanceName)}`, {
        method: 'POST',
        body: { number: phone.replace(/\D/g, ''), text },
    });
    return res.ok ? { ok: true } : { ok: false, error: res.error || 'Send failed' };
}
async function fetchMediaBase64(config, payload) {
    if (!config.instanceName) {
        return { error: 'Evolution API not configured' };
    }
    const res = await (0, httpClient_1.evolutionRequest)(config, `/chat/getBase64FromMediaMessage/${encodeURIComponent(config.instanceName)}`, { method: 'POST', body: { message: payload } });
    if (!res.ok)
        return { error: res.error || 'Media fetch failed' };
    const nested = res.data.data;
    const base64 = (res.data.base64 || nested?.base64);
    const mimetype = (res.data.mimetype || nested?.mimetype || 'application/octet-stream');
    if (!base64)
        return { error: 'No media in response' };
    return { base64, mimetype };
}
