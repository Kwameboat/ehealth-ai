"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAdminRouter = createAdminRouter;
const express_1 = require("express");
const config_1 = require("./config");
const evolution_1 = require("./evolution");
const logs_1 = require("./logs");
const processor_1 = require("./processor");
function isMasked(value) {
    return typeof value === 'string' && value.includes('••••');
}
function createAdminRouter(deps) {
    const router = (0, express_1.Router)();
    router.get('/status', async (_req, res) => {
        try {
            const config = (0, config_1.getWhatsAppConfig)(deps);
            const connection = await (0, evolution_1.fetchConnectionState)(config);
            const logCount = deps
                .getDb()
                .prepare('SELECT COUNT(*) AS c FROM whatsapp_logs')
                .get();
            const registeredPhones = deps
                .getDb()
                .prepare(`SELECT COUNT(*) AS c FROM users WHERE phone IS NOT NULL AND phone != '' AND is_active = 1`)
                .get();
            res.json({
                enabled: config.enabled,
                evolution: {
                    baseUrl: config.baseUrl || null,
                    instanceName: config.instanceName || null,
                    apiKeyConfigured: !!config.apiKey,
                    webhookSecretConfigured: !!config.webhookSecret,
                },
                connection: {
                    ok: connection.ok,
                    state: connection.state || null,
                    error: connection.error || null,
                },
                sync: {
                    registeredPhones: registeredPhones.c || 0,
                    totalLogs: logCount.c || 0,
                },
                models: {
                    text: 'gemini-2.5-flash',
                    audio: 'gemini-2.5-flash',
                    vision: 'gemini-2.5-pro',
                },
                pointCosts: { text: 1, audio: 2, image: 5 },
            });
        }
        catch (err) {
            res.status(500).json({ error: { message: err instanceof Error ? err.message : 'Status failed' } });
        }
    });
    router.get('/logs', (req, res) => {
        try {
            const limit = parseInt(String(req.query.limit || '100'), 10);
            const logs = (0, logs_1.listWhatsAppLogs)(deps, limit);
            res.json({ logs });
        }
        catch (err) {
            res.status(500).json({ error: { message: err instanceof Error ? err.message : 'Logs failed' } });
        }
    });
    router.post('/config', (req, res) => {
        try {
            const body = { ...(req.body || {}) };
            if (isMasked(body.evolutionApiKey))
                delete body.evolutionApiKey;
            if (isMasked(body.webhookSecret))
                delete body.webhookSecret;
            const config = (0, config_1.updateWhatsAppConfig)(deps, body);
            res.json({
                success: true,
                config: {
                    enabled: config.enabled,
                    evolutionBaseUrl: config.baseUrl,
                    instanceName: config.instanceName,
                    evolutionApiKeyConfigured: !!config.apiKey,
                    webhookSecretConfigured: !!config.webhookSecret,
                    systemPrompt: config.systemPrompt,
                },
            });
        }
        catch (err) {
            res.status(500).json({ error: { message: err instanceof Error ? err.message : 'Config update failed' } });
        }
    });
    router.get('/webhook-info', async (_req, res) => {
        try {
            const config = (0, config_1.getWhatsAppConfig)(deps);
            const expectedUrl = `${String(process.env.PUBLIC_APP_URL || 'https://www.ehealthaigh.com').replace(/\/$/, '')}/whatsapp-webhook`;
            const remote = await (0, evolution_1.findEvolutionWebhook)(config);
            res.json({
                expectedUrl,
                remote: remote.ok
                    ? { enabled: remote.enabled, url: remote.url, events: remote.events }
                    : null,
                error: remote.error || null,
                matched: remote.ok && remote.url === expectedUrl,
            });
        }
        catch (err) {
            res.status(500).json({ error: { message: err instanceof Error ? err.message : 'Webhook info failed' } });
        }
    });
    router.post('/register-webhook', async (req, res) => {
        try {
            const config = (0, config_1.getWhatsAppConfig)(deps);
            if (!config.baseUrl || !config.apiKey || !config.instanceName) {
                res.status(400).json({ error: { message: 'Save Evolution URL, API key, and instance name first' } });
                return;
            }
            const origin = (typeof req.body?.webhookUrl === 'string' && req.body.webhookUrl.trim()) ||
                `${String(process.env.PUBLIC_APP_URL || 'https://www.ehealthaigh.com').replace(/\/$/, '')}/whatsapp-webhook`;
            const result = await (0, evolution_1.setEvolutionWebhook)(config, origin);
            if (!result.ok) {
                res.status(502).json({ error: { message: result.error || 'Evolution rejected webhook registration' } });
                return;
            }
            const remote = await (0, evolution_1.findEvolutionWebhook)(config);
            res.json({
                success: true,
                webhookUrl: origin,
                remote: remote.ok ? { enabled: remote.enabled, url: remote.url, events: remote.events } : null,
            });
        }
        catch (err) {
            res.status(500).json({ error: { message: err instanceof Error ? err.message : 'Register webhook failed' } });
        }
    });
    router.post('/broadcast', async (req, res) => {
        try {
            const { message } = req.body || {};
            if (!message || typeof message !== 'string' || !message.trim()) {
                res.status(400).json({ error: { message: 'message text required' } });
                return;
            }
            const config = (0, config_1.getWhatsAppConfig)(deps);
            if (!config.baseUrl || !config.apiKey || !config.instanceName) {
                res.status(400).json({ error: { message: 'Evolution API not fully configured' } });
                return;
            }
            const result = await (0, processor_1.broadcastMessage)(deps, config, message.trim());
            res.json({ success: true, ...result });
        }
        catch (err) {
            res.status(500).json({ error: { message: err instanceof Error ? err.message : 'Broadcast failed' } });
        }
    });
    return router;
}
