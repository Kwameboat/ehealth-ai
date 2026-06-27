"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchConnectionState = fetchConnectionState;
exports.fetchInstanceInfo = fetchInstanceInfo;
exports.createEvolutionInstance = createEvolutionInstance;
exports.connectEvolutionInstance = connectEvolutionInstance;
exports.logoutEvolutionInstance = logoutEvolutionInstance;
exports.findEvolutionWebhook = findEvolutionWebhook;
exports.setEvolutionWebhook = setEvolutionWebhook;
exports.sendTextMessage = sendTextMessage;
exports.fetchMediaBase64 = fetchMediaBase64;
const httpClient_1 = require("./httpClient");
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
function parseConnectPayload(data) {
    const qrcode = data.qrcode;
    const instance = data.instance;
    const base64 = (typeof data.base64 === 'string' && data.base64) ||
        (typeof qrcode?.base64 === 'string' && qrcode.base64) ||
        (typeof data.qr === 'string' && data.qr) ||
        undefined;
    const pairingCode = (typeof data.pairingCode === 'string' && data.pairingCode) ||
        (typeof data.code === 'string' && data.code) ||
        undefined;
    const state = (typeof instance?.status === 'string' && instance.status) ||
        (typeof instance?.state === 'string' && instance.state) ||
        (typeof data.state === 'string' && data.state) ||
        undefined;
    return {
        qrBase64: base64 ? normalizeQrBase64(base64) : undefined,
        pairingCode,
        state,
    };
}
function normalizeQrBase64(value) {
    if (value.startsWith('data:image'))
        return value;
    return `data:image/png;base64,${value.replace(/^data:image\/[a-z]+;base64,/, '')}`;
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
async function createEvolutionInstance(config) {
    const missing = requireEvolutionConfig(config);
    if (missing)
        return { ok: false, error: missing };
    const res = await (0, httpClient_1.evolutionRequest)(config, '/instance/create', {
        method: 'POST',
        body: {
            instanceName: config.instanceName,
            integration: 'WHATSAPP-BAILEYS',
            qrcode: true,
        },
    });
    if (!res.ok) {
        const msg = (res.error || '').toLowerCase();
        if (msg.includes('already') || msg.includes('exist')) {
            return connectEvolutionInstance(config);
        }
        return { ok: false, error: res.error || 'Instance creation failed' };
    }
    const parsed = parseConnectPayload(res.data);
    return { ok: true, created: true, ...parsed };
}
async function connectEvolutionInstance(config, phone) {
    const missing = requireEvolutionConfig(config);
    if (missing)
        return { ok: false, error: missing };
    const digits = phone?.replace(/\D/g, '');
    const query = digits ? `?number=${encodeURIComponent(digits)}` : '';
    const res = await (0, httpClient_1.evolutionRequest)(config, `/instance/connect/${encodeURIComponent(config.instanceName)}${query}`);
    if (!res.ok)
        return { ok: false, error: res.error || 'Connect failed' };
    const parsed = parseConnectPayload(res.data);
    return { ok: true, ...parsed };
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
