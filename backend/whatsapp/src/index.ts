import type { WhatsAppDeps } from './deps';
import { createAdminRouter } from './adminRouter';
import { createWebhookRouter } from './webhookRouter';
import { startWhatsAppScheduler } from './scheduler';

let schedulerStarted = false;

export function createWhatsAppRouters(deps: WhatsAppDeps) {
  if (!schedulerStarted) {
    schedulerStarted = true;
    startWhatsAppScheduler(deps);
  }
  return {
    adminRouter: createAdminRouter(deps),
    webhookRouter: createWebhookRouter(deps),
  };
}

export { getWhatsAppConfig, updateWhatsAppConfig } from './config';
export { normalizePhone } from './phone';
