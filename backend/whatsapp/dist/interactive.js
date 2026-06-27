"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendButtonsMessage = sendButtonsMessage;
exports.sendListMessage = sendListMessage;
async function sendButtonsMessage(config, phone, opts) {
    try {
        const axios = (await Promise.resolve().then(() => __importStar(require('axios')))).default;
        if (!config.baseUrl || !config.apiKey || !config.instanceName) {
            return { ok: false, error: 'Evolution API not configured' };
        }
        await axios.post(`${config.baseUrl}/message/sendButtons/${encodeURIComponent(config.instanceName)}`, {
            number: phone.replace(/\D/g, ''),
            title: opts.title.slice(0, 60),
            description: opts.description.slice(0, 1024),
            footer: opts.footer?.slice(0, 60) || 'eHealth AI · Agyenim',
            buttons: opts.buttons.slice(0, 3).map((b) => ({
                type: 'reply',
                displayText: b.displayText.slice(0, 25),
                id: b.id.slice(0, 128),
            })),
        }, { headers: { apikey: config.apiKey }, timeout: 45000 });
        return { ok: true };
    }
    catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : 'Buttons send failed' };
    }
}
async function sendListMessage(config, phone, opts) {
    try {
        const axios = (await Promise.resolve().then(() => __importStar(require('axios')))).default;
        if (!config.baseUrl || !config.apiKey || !config.instanceName) {
            return { ok: false, error: 'Evolution API not configured' };
        }
        await axios.post(`${config.baseUrl}/message/sendList/${encodeURIComponent(config.instanceName)}`, {
            number: phone.replace(/\D/g, ''),
            title: opts.title.slice(0, 60),
            description: opts.description.slice(0, 1024),
            buttonText: opts.buttonText.slice(0, 20),
            footerText: 'eHealth AI',
            sections: [
                {
                    title: 'Options',
                    rows: opts.rows.slice(0, 10).map((r) => ({
                        title: r.title.slice(0, 24),
                        description: (r.description || '').slice(0, 72),
                        rowId: r.id.slice(0, 128),
                    })),
                },
            ],
        }, { headers: { apikey: config.apiKey }, timeout: 45000 });
        return { ok: true };
    }
    catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : 'List send failed' };
    }
}
