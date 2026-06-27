"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchConnectionState = fetchConnectionState;
exports.sendTextMessage = sendTextMessage;
exports.fetchMediaBase64 = fetchMediaBase64;
const httpClient_1 = require("./httpClient");
async function fetchConnectionState(config) {
    if (!config.instanceName) {
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
