"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchConnectionState = fetchConnectionState;
exports.findEvolutionWebhook = findEvolutionWebhook;
exports.setEvolutionWebhook = setEvolutionWebhook;
exports.sendTextMessage = sendTextMessage;
exports.fetchMediaBase64 = fetchMediaBase64;
const httpClient_1 = require("./httpClient");
async function fetchConnectionState(config) {
    if (!config.baseUrl || !config.apiKey || !config.instanceName) {
        return { ok: false, error: 'Evolution API URL, key, or instance name not configured' };
    }
    const res = await (0, httpClient_1.evolutionRequest)(config, `/instance/connectionState/${encodeURIComponent(config.instanceName)}`);
    if (!res.ok)
        return { ok: false, error: res.error || 'Connection check failed' };
    const instance = res.data.instance;
    const state = instance?.state ||
        res.data.state ||
        res.data.connectionStatus ||
        'unknown';
    return { ok: true, state: String(state), instance: config.instanceName };
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
