import type { WhatsAppDeps } from './deps';
import { createAdminRouter } from './adminRouter';
import { createWebhookRouter } from './webhookRouter';
import { startWhatsAppScheduler } from './scheduler';
import { getWhatsAppConfig } from './config';

let schedulerStarted = false;

export function createWhatsAppRouters(deps: WhatsAppDeps) {
  const config = getWhatsAppConfig(deps);
  if (!schedulerStarted && config.enabled && config.baseUrl && config.apiKey && config.instanceName) {
    schedulerStarted = true;
    startWhatsAppScheduler(deps);
  } else if (!config.enabled) {
    console.log('[whatsapp] loaded (scheduler idle — WhatsApp disabled in admin)');
  }
  return {
    adminRouter: createAdminRouter(deps),
    webhookRouter: createWebhookRouter(deps),
  };
}

export { getWhatsAppConfig, updateWhatsAppConfig } from './config';
export { normalizePhone } from './phone';
