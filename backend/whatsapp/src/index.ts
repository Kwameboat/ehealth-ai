import type { WhatsAppDeps } from './deps';
import { createAdminRouter } from './adminRouter';
import { createWebhookRouter } from './webhookRouter';

export function createWhatsAppRouters(deps: WhatsAppDeps) {
  return {
    adminRouter: createAdminRouter(deps),
    webhookRouter: createWebhookRouter(deps),
  };
}

export { getWhatsAppConfig, updateWhatsAppConfig } from './config';
export { normalizePhone } from './phone';
