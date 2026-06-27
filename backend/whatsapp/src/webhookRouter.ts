import { Router, type Request, type Response } from 'express';
import type { WhatsAppDeps } from './deps';
import { getWhatsAppConfig } from './config';
import { parseEvolutionPayload, processIncomingMessage } from './processor';

export function createWebhookRouter(deps: WhatsAppDeps & { ensureDbReady?: () => Promise<void> }): Router {
  const router = Router();

  router.post('/', (req: Request, res: Response) => {
    res.status(200).json({ ok: true, received: true });

    setImmediate(() => {
      handleWebhook(deps, req.body, req.headers as Record<string, unknown>).catch((err) => {
        console.error('[whatsapp-webhook] unhandled:', err);
      });
    });
  });

  return router;
}

async function handleWebhook(
  deps: WhatsAppDeps & { ensureDbReady?: () => Promise<void> },
  body: unknown,
  headers: Record<string, unknown>
) {
  try {
    if (deps.ensureDbReady) await deps.ensureDbReady();
    const config = getWhatsAppConfig(deps);

    if (config.webhookSecret) {
      const token =
        headers['x-webhook-secret'] ||
        headers['x-evolution-secret'] ||
        headers['authorization'];
      const provided = String(token || '').replace(/^Bearer\s+/i, '');
      if (provided !== config.webhookSecret) {
        console.warn('[whatsapp-webhook] rejected: invalid secret');
        return;
      }
    }

    const parsed = parseEvolutionPayload(body);
    if (!parsed) return;

    if (body && typeof body === 'object') {
      const event = String((body as Record<string, unknown>).event || '').toLowerCase();
      if (event && !event.includes('message')) return;
    }

    await processIncomingMessage(deps, config, parsed);
  } catch (err) {
    console.error('[whatsapp-webhook] processing error:', err);
  }
}
