import { Router, type Request, type Response } from 'express';
import type { WhatsAppDeps } from './deps';
import { getWhatsAppConfig, updateWhatsAppConfig } from './config';
import { fetchConnectionState } from './evolution';
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
