"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evolutionRequest = evolutionRequest;
const { postJson, getJson } = require('../../services/httpsJson');
async function evolutionRequest(config, path, options = {}) {
    if (!config.baseUrl || !config.apiKey) {
        return { ok: false, status: 0, data: {}, error: 'Evolution API not configured' };
    }
    const url = `${config.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
    const headers = {
        apikey: config.apiKey,
        'Content-Type': 'application/json',
    };
    try {
        const method = (options.method || 'GET').toUpperCase();
        const result =
            method === 'POST'
                ? await postJson(url, options.body !== undefined ? options.body : {}, 45_000, headers)
                : await getJson(url, headers, 45_000);
        const { status, data } = result;
        if (status < 200 || status >= 300) {
            const msg = (typeof data.message === 'string' && data.message) ||
                (typeof data.error === 'string' && data.error) ||
                (typeof data.response === 'string' && data.response) ||
                `HTTP ${status}`;
            const hint = status === 401
                ? ' — use CloudStation global API key or this instance Token in Evolution API key field'
                : '';
            return { ok: false, status, data, error: `${msg}${hint}` };
        }
        return { ok: true, status, data };
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Request failed';
        return { ok: false, status: 0, data: {}, error: message };
    }
}
