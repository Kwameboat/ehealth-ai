"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createWebhookRouter = createWebhookRouter;
const express_1 = require("express");
const config_1 = require("./config");
const processor_1 = require("./processor");
function createWebhookRouter(deps) {
    const router = (0, express_1.Router)();
    router.post('/', (req, res) => {
        res.status(200).json({ ok: true, received: true });
        setImmediate(() => {
            handleWebhook(deps, req.body, req.headers).catch((err) => {
                console.error('[whatsapp-webhook] unhandled:', err);
            });
        });
    });
    return router;
}
async function handleWebhook(deps, body, headers) {
    try {
        if (deps.ensureDbReady)
            await deps.ensureDbReady();
        const config = (0, config_1.getWhatsAppConfig)(deps);
        if (config.webhookSecret) {
            const token = headers['x-webhook-secret'] ||
                headers['x-evolution-secret'] ||
                headers['authorization'];
            const provided = String(token || '').replace(/^Bearer\s+/i, '');
            if (provided !== config.webhookSecret) {
                console.warn('[whatsapp-webhook] rejected: invalid secret');
                return;
            }
        }
        const parsed = (0, processor_1.parseEvolutionPayload)(body);
        if (!parsed)
            return;
        if (body && typeof body === 'object') {
            const event = String(body.event || '').toLowerCase();
            if (event && !event.includes('message'))
                return;
        }
        await (0, processor_1.processIncomingMessage)(deps, config, parsed);
    }
    catch (err) {
        console.error('[whatsapp-webhook] processing error:', err);
    }
}
