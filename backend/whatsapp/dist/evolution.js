"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchConnectionState = fetchConnectionState;
exports.sendTextMessage = sendTextMessage;
exports.fetchMediaBase64 = fetchMediaBase64;
const axios_1 = __importDefault(require("axios"));
function client(config) {
    if (!config.baseUrl || !config.apiKey)
        return null;
    return axios_1.default.create({
        baseURL: config.baseUrl,
        headers: { apikey: config.apiKey, 'Content-Type': 'application/json' },
        timeout: 45000,
    });
}
async function fetchConnectionState(config) {
    try {
        const http = client(config);
        if (!http || !config.instanceName) {
            return { ok: false, error: 'Evolution API URL, key, or instance name not configured' };
        }
        const res = await http.get(`/instance/connectionState/${encodeURIComponent(config.instanceName)}`);
        const state = res.data?.instance?.state ||
            res.data?.state ||
            res.data?.connectionStatus ||
            'unknown';
        return { ok: true, state: String(state), instance: config.instanceName };
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Connection check failed';
        return { ok: false, error: message };
    }
}
async function sendTextMessage(config, phone, text) {
    try {
        const http = client(config);
        if (!http || !config.instanceName) {
            return { ok: false, error: 'Evolution API not configured' };
        }
        await http.post(`/message/sendText/${encodeURIComponent(config.instanceName)}`, {
            number: phone.replace(/\D/g, ''),
            text,
        });
        return { ok: true };
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Send failed';
        return { ok: false, error: message };
    }
}
async function fetchMediaBase64(config, payload) {
    try {
        const http = client(config);
        if (!http || !config.instanceName) {
            return { error: 'Evolution API not configured' };
        }
        const res = await http.post(`/chat/getBase64FromMediaMessage/${encodeURIComponent(config.instanceName)}`, { message: payload });
        const base64 = res.data?.base64 || res.data?.data?.base64;
        const mimetype = res.data?.mimetype || res.data?.data?.mimetype || 'application/octet-stream';
        if (!base64)
            return { error: 'No media in response' };
        return { base64, mimetype };
    }
    catch (err) {
        return { error: err instanceof Error ? err.message : 'Media fetch failed' };
    }
}
