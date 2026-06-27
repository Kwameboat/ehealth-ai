import { Router, type Request, type Response } from 'express';
import type { WhatsAppDeps } from './deps';
import { getWhatsAppConfig, updateWhatsAppConfig } from './config';
import { fetchConnectionState, findEvolutionWebhook, setEvolutionWebhook, createEvolutionInstance, connectEvolutionInstance, logoutEvolutionInstance, fetchInstanceInfo } from './evolution';
import { listWhatsAppLogs } from './logs';
import { broadcastMessage } from './processor';

function isMasked(value: unknown): boolean {
  return typeof value === 'string' && value.includes('••••');
}

export function createAdminRouter(deps: WhatsAppDeps): Router {
  const router = Router();

  router.get('/status', async (_req: Request, res: Response) => {
    try {
      const config = getWhatsAppConfig(deps);
      const connection = await fetchConnectionState(config);
      const instanceInfo = await fetchInstanceInfo(config);
      const logCount = deps
        .getDb()
        .prepare('SELECT COUNT(*) AS c FROM whatsapp_logs')
        .get() as { c: number };
      const registeredPhones = deps
        .getDb()
        .prepare(
          `SELECT COUNT(*) AS c FROM users WHERE phone IS NOT NULL AND phone != '' AND is_active = 1`
        )
        .get() as { c: number };

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
    } catch (err: unknown) {
      res.status(500).json({ error: { message: err instanceof Error ? err.message : 'Status failed' } });
    }
  });

  router.get('/logs', (req: Request, res: Response) => {
    try {
      const limit = parseInt(String(req.query.limit || '100'), 10);
      const logs = listWhatsAppLogs(deps, limit);
      res.json({ logs });
    } catch (err: unknown) {
      res.status(500).json({ error: { message: err instanceof Error ? err.message : 'Logs failed' } });
    }
  });

  router.post('/config', (req: Request, res: Response) => {
    try {
      const body = { ...(req.body || {}) };
      if (isMasked(body.evolutionApiKey)) delete body.evolutionApiKey;
      if (isMasked(body.webhookSecret)) delete body.webhookSecret;

      const config = updateWhatsAppConfig(deps, body);
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
    } catch (err: unknown) {
      res.status(500).json({ error: { message: err instanceof Error ? err.message : 'Config update failed' } });
    }
  });

  router.get('/webhook-info', async (_req: Request, res: Response) => {
    try {
      const config = getWhatsAppConfig(deps);
      const expectedUrl = `${String(process.env.PUBLIC_APP_URL || 'https://www.ehealthaigh.com').replace(/\/$/, '')}/whatsapp-webhook`;
      const remote = await findEvolutionWebhook(config);
      res.json({
        expectedUrl,
        remote: remote.ok
          ? { enabled: remote.enabled, url: remote.url, events: remote.events }
          : null,
        error: remote.error || null,
        matched: remote.ok && remote.url === expectedUrl,
      });
    } catch (err: unknown) {
      res.status(500).json({ error: { message: err instanceof Error ? err.message : 'Webhook info failed' } });
    }
  });

  router.get('/connection', async (_req: Request, res: Response) => {
    try {
      const config = getWhatsAppConfig(deps);
      const [connection, instanceInfo] = await Promise.all([
        fetchConnectionState(config),
        fetchInstanceInfo(config),
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
    } catch (err: unknown) {
      res.status(500).json({ error: { message: err instanceof Error ? err.message : 'Connection failed' } });
    }
  });

  router.post('/connection/create', async (_req: Request, res: Response) => {
    try {
      const config = getWhatsAppConfig(deps);
      if (!config.baseUrl || !config.apiKey || !config.instanceName) {
        res.status(400).json({ error: { message: 'Save Evolution URL, API key, and instance name first' } });
        return;
      }
      const result = await createEvolutionInstance(config);
      if (!result.ok) {
        res.status(502).json({ error: { message: result.error || 'Create instance failed' } });
        return;
      }
      res.json({
        success: true,
        created: result.created ?? false,
        qrBase64: result.qrBase64 || null,
        pairingCode: result.pairingCode || null,
        state: result.state || 'connecting',
      });
    } catch (err: unknown) {
      res.status(500).json({ error: { message: err instanceof Error ? err.message : 'Create instance failed' } });
    }
  });

  router.post('/connection/connect', async (req: Request, res: Response) => {
    try {
      const config = getWhatsAppConfig(deps);
      if (!config.baseUrl || !config.apiKey || !config.instanceName) {
        res.status(400).json({ error: { message: 'Save Evolution URL, API key, and instance name first' } });
        return;
      }
      const phone = typeof req.body?.phone === 'string' ? req.body.phone.trim() : undefined;
      let result = await connectEvolutionInstance(config, phone);
      if (!result.ok && !phone) {
        const info = await fetchInstanceInfo(config);
        if (!info.exists) {
          result = await createEvolutionInstance(config);
        }
      }
      if (!result.ok) {
        res.status(502).json({ error: { message: result.error || 'Connect failed' } });
        return;
      }
      const connection = await fetchConnectionState(config);
      res.json({
        success: true,
        qrBase64: result.qrBase64 || null,
        pairingCode: result.pairingCode || null,
        state: connection.state || result.state || 'connecting',
        phone: connection.phone || null,
      });
    } catch (err: unknown) {
      res.status(500).json({ error: { message: err instanceof Error ? err.message : 'Connect failed' } });
    }
  });

  router.post('/connection/logout', async (_req: Request, res: Response) => {
    try {
      const config = getWhatsAppConfig(deps);
      if (!config.baseUrl || !config.apiKey || !config.instanceName) {
        res.status(400).json({ error: { message: 'Evolution API not configured' } });
        return;
      }
      const result = await logoutEvolutionInstance(config);
      if (!result.ok) {
        res.status(502).json({ error: { message: result.error || 'Logout failed' } });
        return;
      }
      res.json({ success: true });
    } catch (err: unknown) {
      res.status(500).json({ error: { message: err instanceof Error ? err.message : 'Logout failed' } });
    }
  });

  router.post('/register-webhook', async (req: Request, res: Response) => {
    try {
      const config = getWhatsAppConfig(deps);
      if (!config.baseUrl || !config.apiKey || !config.instanceName) {
        res.status(400).json({ error: { message: 'Save Evolution URL, API key, and instance name first' } });
        return;
      }
      const origin =
        (typeof req.body?.webhookUrl === 'string' && req.body.webhookUrl.trim()) ||
        `${String(process.env.PUBLIC_APP_URL || 'https://www.ehealthaigh.com').replace(/\/$/, '')}/whatsapp-webhook`;
      const result = await setEvolutionWebhook(config, origin);
      if (!result.ok) {
        res.status(502).json({ error: { message: result.error || 'Evolution rejected webhook registration' } });
        return;
      }
      const remote = await findEvolutionWebhook(config);
      res.json({
        success: true,
        webhookUrl: origin,
        remote: remote.ok ? { enabled: remote.enabled, url: remote.url, events: remote.events } : null,
      });
    } catch (err: unknown) {
      res.status(500).json({ error: { message: err instanceof Error ? err.message : 'Register webhook failed' } });
    }
  });

  router.post('/broadcast', async (req: Request, res: Response) => {
    try {
      const { message } = req.body || {};
      if (!message || typeof message !== 'string' || !message.trim()) {
        res.status(400).json({ error: { message: 'message text required' } });
        return;
      }
      const config = getWhatsAppConfig(deps);
      if (!config.baseUrl || !config.apiKey || !config.instanceName) {
        res.status(400).json({ error: { message: 'Evolution API not fully configured' } });
        return;
      }
      const result = await broadcastMessage(deps, config, message.trim());
      res.json({ success: true, ...result });
    } catch (err: unknown) {
      res.status(500).json({ error: { message: err instanceof Error ? err.message : 'Broadcast failed' } });
    }
  });

  return router;
}
