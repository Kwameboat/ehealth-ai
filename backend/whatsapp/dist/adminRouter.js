"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAdminRouter = createAdminRouter;
const express_1 = require("express");
const config_1 = require("./config");
const evolution_1 = require("./evolution");
const phone_1 = require("./phone");
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
            const instanceInfo = await (0, evolution_1.fetchInstanceInfo)(config);
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
                    phone: connection.phone || null,
                    profileName: connection.profileName || null,
                    instanceExists: instanceInfo.exists ?? null,
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
    router.get('/connection', async (_req, res) => {
        try {
            const config = (0, config_1.getWhatsAppConfig)(deps);
            const [connection, instanceInfo] = await Promise.all([
                (0, evolution_1.fetchConnectionState)(config),
                (0, evolution_1.fetchInstanceInfo)(config),
            ]);
            res.json({
                configured: !!(config.baseUrl && config.apiKey && config.instanceName),
                instanceName: config.instanceName || null,
                instanceExists: instanceInfo.exists ?? false,
                state: connection.state || instanceInfo.state || 'close',
                phone: connection.phone || instanceInfo.phone || null,
                profileName: connection.profileName || instanceInfo.profileName || null,
                error: connection.error || instanceInfo.error || null,
            });
        }
        catch (err) {
            res.status(500).json({ error: { message: err instanceof Error ? err.message : 'Connection failed' } });
        }
    });
    router.post('/connection/create', async (_req, res) => {
        try {
            const config = (0, config_1.getWhatsAppConfig)(deps);
            if (!config.baseUrl || !config.apiKey || !config.instanceName) {
                res.status(400).json({ error: { message: 'Save Evolution URL, API key, and instance name first' } });
                return;
            }
            let result = await (0, evolution_1.createEvolutionInstance)(config);
            if (!result.ok) {
                res.status(502).json({ error: { message: result.error || 'Create instance failed' } });
                return;
            }
            if (!result.qrBase64 && !result.qrCode && !result.pairingCode) {
                const retry = await (0, evolution_1.fetchEvolutionQrWithRetry)(config);
                if (retry.qrBase64 || retry.qrCode || retry.pairingCode) {
                    result = { ...result, ...retry };
                }
            }
            res.json({
                success: true,
                created: result.created ?? false,
                qrBase64: result.qrBase64 || null,
                qrCode: result.qrCode || null,
                pairingCode: result.pairingCode || null,
                state: result.state || 'connecting',
            });
        }
        catch (err) {
            res.status(500).json({ error: { message: err instanceof Error ? err.message : 'Create instance failed' } });
        }
    });
    router.post('/connection/pair', async (req, res) => {
        try {
            const config = (0, config_1.getWhatsAppConfig)(deps);
            if (!config.baseUrl || !config.apiKey || !config.instanceName) {
                res.status(400).json({ error: { message: 'Save Evolution URL, API key, and instance name first' } });
                return;
            }
            const phone = typeof req.body?.phone === 'string' ? req.body.phone.trim() : '';
            if (!phone) {
                res.status(400).json({ error: { message: 'WhatsApp phone number is required' } });
                return;
            }
            const connection = await (0, evolution_1.fetchConnectionState)(config);
            if (String(connection.state || '').toLowerCase() === 'open') {
                res.json({
                    success: true,
                    state: 'open',
                    phone: connection.phone || (0, phone_1.normalizePhone)(phone),
                    pairingCode: null,
                });
                return;
            }
            const pairResult = await (0, evolution_1.fetchEvolutionPairingWithRetry)(config, phone);
            if (!pairResult.ok || !pairResult.pairingCode) {
                res.status(502).json({
                    error: {
                        message: pairResult.error || 'Could not get WhatsApp link code from Evolution',
                        hint: 'Use Ghana format 0501234567 or 233501234567. Confirm Evolution API key and instance name.',
                    },
                });
                return;
            }
            const after = await (0, evolution_1.fetchConnectionState)(config);
            res.json({
                success: true,
                pairingCode: pairResult.pairingCode,
                linkPhone: pairResult.phone || (0, phone_1.normalizePhone)(phone),
                state: after.state || pairResult.state || 'connecting',
                phone: after.phone || null,
                message: 'Enter this code in WhatsApp within 60 seconds',
            });
        }
        catch (err) {
            res.status(500).json({ error: { message: err instanceof Error ? err.message : 'Pair failed' } });
        }
    });
    router.post('/connection/connect', async (req, res) => {
        try {
            const config = (0, config_1.getWhatsAppConfig)(deps);
            if (!config.baseUrl || !config.apiKey || !config.instanceName) {
                res.status(400).json({ error: { message: 'Save Evolution URL, API key, and instance name first' } });
                return;
            }
            const phone = typeof req.body?.phone === 'string' ? req.body.phone.trim() : undefined;
            const forceRefresh = req.body?.forceRefresh === true;
            const mode = req.body?.mode === 'pair' ? 'pair' : 'qr';
            const connection = await (0, evolution_1.fetchConnectionState)(config);
            const state = String(connection.state || 'close').toLowerCase();
            if (state === 'open') {
                res.json({
                    success: true,
                    state: 'open',
                    phone: connection.phone || null,
                    qrBase64: null,
                    pairingInProgress: false,
                });
                return;
            }
            if (forceRefresh && state === 'connecting') {
                await (0, evolution_1.logoutEvolutionInstance)(config);
            }
            if (mode === 'pair') {
                if (!phone) {
                    res.status(400).json({ error: { message: 'Enter your WhatsApp phone number to get a link code' } });
                    return;
                }
                const pairResult = await (0, evolution_1.fetchEvolutionPairingWithRetry)(config, phone);
                if (!pairResult.ok) {
                    res.status(502).json({ error: { message: pairResult.error || 'Link code request failed' } });
                    return;
                }
                const after = await (0, evolution_1.fetchConnectionState)(config);
                res.json({
                    success: true,
                    mode: 'pair',
                    pairingCode: pairResult.pairingCode || null,
                    qrBase64: null,
                    qrCode: null,
                    linkPhone: pairResult.phone || (0, phone_1.normalizePhone)(phone),
                    state: after.state || pairResult.state || 'connecting',
                    phone: after.phone || null,
                    pairingInProgress: !pairResult.pairingCode,
                    message: pairResult.pairingCode
                        ? 'Enter this code in WhatsApp within 60 seconds'
                        : pairResult.error || null,
                });
                return;
            }
            const result = await (0, evolution_1.fetchEvolutionQrWithRetry)(config, phone);
            if (!result.ok) {
                res.status(502).json({ error: { message: result.error || 'Connect failed' } });
                return;
            }
            const after = await (0, evolution_1.fetchConnectionState)(config);
            const hasQr = !!(result.qrBase64 || result.qrCode);
            res.json({
                success: true,
                qrBase64: result.qrBase64 || null,
                qrCode: result.qrCode || null,
                pairingCode: result.pairingCode || null,
                state: after.state || result.state || 'connecting',
                phone: after.phone || null,
                pairingInProgress: !hasQr && String(after.state || result.state || '').toLowerCase() === 'connecting',
                message: hasQr
                    ? null
                    : result.error ||
                        'No QR from Evolution yet — verify instance name and API key (CloudStation instance Token).',
            });
        }
        catch (err) {
            res.status(500).json({ error: { message: err instanceof Error ? err.message : 'Connect failed' } });
        }
    });
    router.post('/connection/logout', async (_req, res) => {
        try {
            const config = (0, config_1.getWhatsAppConfig)(deps);
            if (!config.baseUrl || !config.apiKey || !config.instanceName) {
                res.status(400).json({ error: { message: 'Evolution API not configured' } });
                return;
            }
            const result = await (0, evolution_1.logoutEvolutionInstance)(config);
            if (!result.ok) {
                res.status(502).json({ error: { message: result.error || 'Logout failed' } });
                return;
            }
            res.json({ success: true });
        }
        catch (err) {
            res.status(500).json({ error: { message: err instanceof Error ? err.message : 'Logout failed' } });
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
            const broadcastId = deps.uuid();
            deps
                .getDb()
                .prepare(`INSERT INTO health_broadcasts (id, title, message, recipient_count, created_at)
           VALUES (?, ?, ?, ?, ?)`)
                .run(broadcastId, 'Health alert', message.trim(), result.sent, deps.now());
            res.json({ success: true, broadcastId, ...result });
        }
        catch (err) {
            res.status(500).json({ error: { message: err instanceof Error ? err.message : 'Broadcast failed' } });
        }
    });
    return router;
}
