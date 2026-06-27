import type { WhatsAppDeps } from './deps';

export interface WhatsAppConfig {
  enabled: boolean;
  baseUrl: string;
  apiKey: string;
  instanceName: string;
  webhookSecret: string;
  systemPrompt: string;
}

const CONFIG_KEYS = {
  enabled: 'whatsapp_enabled',
  baseUrl: 'whatsapp_evolution_base_url',
  apiKey: 'whatsapp_evolution_api_key',
  instanceName: 'whatsapp_instance_name',
  webhookSecret: 'whatsapp_webhook_secret',
  systemPrompt: 'whatsapp_system_prompt',
} as const;

export function getWhatsAppConfig(deps: WhatsAppDeps): WhatsAppConfig {
  return {
    enabled: deps.getSetting(CONFIG_KEYS.enabled, 'false') === 'true',
    baseUrl: (deps.getSetting(CONFIG_KEYS.baseUrl, '') || '').replace(/\/$/, ''),
    apiKey: deps.getSetting(CONFIG_KEYS.apiKey, '') || '',
    instanceName: deps.getSetting(CONFIG_KEYS.instanceName, '') || '',
    webhookSecret: deps.getSetting(CONFIG_KEYS.webhookSecret, '') || '',
    systemPrompt:
      deps.getSetting(
        CONFIG_KEYS.systemPrompt,
        'You are Agyenim, the eHealth AI assistant on WhatsApp. Give concise, caring health guidance in plain language. Not a doctor — advise seeing a clinician when needed.'
      ) || '',
  };
}

function isValidEvolutionBaseUrl(value: string): boolean {
  if (!value || value.includes('\\') || /^[a-zA-Z]:/.test(value)) return false;
  try {
    const u = new URL(value);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

export function updateWhatsAppConfig(
  deps: WhatsAppDeps,
  body: Record<string, unknown>
): WhatsAppConfig {
  const map: Record<string, string> = {
    enabled: CONFIG_KEYS.enabled,
    evolutionBaseUrl: CONFIG_KEYS.baseUrl,
    evolutionApiKey: CONFIG_KEYS.apiKey,
    instanceName: CONFIG_KEYS.instanceName,
    webhookSecret: CONFIG_KEYS.webhookSecret,
    systemPrompt: CONFIG_KEYS.systemPrompt,
  };

  for (const [field, key] of Object.entries(map)) {
    if (body[field] !== undefined) {
      const val = body[field];
      if (field === 'enabled') {
        deps.setSetting(key, val ? 'true' : 'false');
      } else if (typeof val === 'string') {
        const trimmed = val.trim();
        if (field === 'evolutionBaseUrl' && trimmed && !isValidEvolutionBaseUrl(trimmed)) {
          throw new Error(
            'Evolution base URL must be a valid https URL (e.g. https://cst-evolution-api-….usecloudstation.com), not a local file path.'
          );
        }
        deps.setSetting(key, trimmed);
      }
    }
  }

  return getWhatsAppConfig(deps);
}

export { CONFIG_KEYS };
