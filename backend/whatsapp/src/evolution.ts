import type { WhatsAppConfig } from './config';
import { evolutionRequest } from './httpClient';

function requireEvolutionConfig(config: WhatsAppConfig): string | null {
  if (!config.baseUrl || !config.apiKey || !config.instanceName) {
    return 'Evolution API URL, key, or instance name not configured';
  }
  return null;
}

function extractPhoneFromJid(jid: unknown): string | undefined {
  if (!jid || typeof jid !== 'string') return undefined;
  const digits = jid.split('@')[0]?.replace(/\D/g, '');
  return digits || undefined;
}

function parseConnectPayload(data: Record<string, unknown>): {
  qrBase64?: string;
  pairingCode?: string;
  state?: string;
} {
  const qrcode = data.qrcode as Record<string, unknown> | undefined;
  const instance = data.instance as Record<string, unknown> | undefined;
  const base64 =
    (typeof data.base64 === 'string' && data.base64) ||
    (typeof qrcode?.base64 === 'string' && qrcode.base64) ||
    (typeof data.qr === 'string' && data.qr) ||
    undefined;
  const pairingCode =
    (typeof data.pairingCode === 'string' && data.pairingCode) ||
    (typeof data.code === 'string' && data.code) ||
    undefined;
  const state =
    (typeof instance?.status === 'string' && instance.status) ||
    (typeof instance?.state === 'string' && instance.state) ||
    (typeof data.state === 'string' && data.state) ||
    undefined;
  return {
    qrBase64: base64 ? normalizeQrBase64(base64) : undefined,
    pairingCode,
    state,
  };
}

function normalizeQrBase64(value: string): string {
  if (value.startsWith('data:image')) return value;
  return `data:image/png;base64,${value.replace(/^data:image\/[a-z]+;base64,/, '')}`;
}

function parseInstanceRow(row: Record<string, unknown>): {
  state?: string;
  phone?: string;
  profileName?: string;
} {
  const instance = (row.instance as Record<string, unknown>) || row;
  const state = String(
    instance.status ||
      instance.state ||
      instance.connectionStatus ||
      row.status ||
      row.state ||
      ''
  );
  const phone =
    extractPhoneFromJid(row.ownerJid) ||
    extractPhoneFromJid(instance.ownerJid) ||
    extractPhoneFromJid(row.number) ||
    extractPhoneFromJid(instance.number);
  const profileName =
    (typeof row.profileName === 'string' && row.profileName) ||
    (typeof instance.profileName === 'string' && instance.profileName) ||
    undefined;
  return { state: state || undefined, phone, profileName };
}

export async function fetchInstanceInfo(config: WhatsAppConfig): Promise<{
  ok: boolean;
  exists?: boolean;
  state?: string;
  phone?: string;
  profileName?: string;
  error?: string;
}> {
  const missing = requireEvolutionConfig(config);
  if (missing) return { ok: false, error: missing };

  const res = await evolutionRequest(
    config,
    `/instance/fetchInstances?instanceName=${encodeURIComponent(config.instanceName)}`
  );
  if (!res.ok) {
    const all = await evolutionRequest(config, '/instance/fetchInstances');
    if (!all.ok) return { ok: false, error: res.error || all.error || 'Instance lookup failed' };
    const rows = Array.isArray(all.data) ? all.data : (all.data as Record<string, unknown>).instances;
    const list = Array.isArray(rows) ? rows : [];
    const match = list.find((row) => {
      const inst = ((row as Record<string, unknown>).instance as Record<string, unknown>) || row;
      return String(inst.instanceName || inst.name || '') === config.instanceName;
    }) as Record<string, unknown> | undefined;
    if (!match) return { ok: true, exists: false };
    const parsed = parseInstanceRow(match);
    return { ok: true, exists: true, ...parsed };
  }

  const rows = Array.isArray(res.data)
    ? res.data
    : Array.isArray(res.data.instances)
      ? (res.data.instances as unknown[])
      : res.data.instance
        ? [res.data]
        : [];
  const list = rows as Record<string, unknown>[];
  if (!list.length) return { ok: true, exists: false };
  const parsed = parseInstanceRow(list[0]);
  return { ok: true, exists: true, ...parsed };
}

export async function createEvolutionInstance(config: WhatsAppConfig): Promise<{
  ok: boolean;
  created?: boolean;
  qrBase64?: string;
  pairingCode?: string;
  state?: string;
  error?: string;
}> {
  const missing = requireEvolutionConfig(config);
  if (missing) return { ok: false, error: missing };

  const res = await evolutionRequest(config, '/instance/create', {
    method: 'POST',
    body: {
      instanceName: config.instanceName,
      integration: 'WHATSAPP-BAILEYS',
      qrcode: true,
    },
  });

  if (!res.ok) {
    const msg = (res.error || '').toLowerCase();
    if (msg.includes('already') || msg.includes('exist')) {
      return connectEvolutionInstance(config);
    }
    return { ok: false, error: res.error || 'Instance creation failed' };
  }

  const parsed = parseConnectPayload(res.data);
  return { ok: true, created: true, ...parsed };
}

export async function connectEvolutionInstance(
  config: WhatsAppConfig,
  phone?: string
): Promise<{
  ok: boolean;
  qrBase64?: string;
  pairingCode?: string;
  state?: string;
  error?: string;
}> {
  const missing = requireEvolutionConfig(config);
  if (missing) return { ok: false, error: missing };

  const digits = phone?.replace(/\D/g, '');
  const query = digits ? `?number=${encodeURIComponent(digits)}` : '';
  const res = await evolutionRequest(
    config,
    `/instance/connect/${encodeURIComponent(config.instanceName)}${query}`
  );
  if (!res.ok) return { ok: false, error: res.error || 'Connect failed' };

  const parsed = parseConnectPayload(res.data);
  return { ok: true, ...parsed };
}

export async function logoutEvolutionInstance(config: WhatsAppConfig): Promise<{
  ok: boolean;
  error?: string;
}> {
  const missing = requireEvolutionConfig(config);
  if (missing) return { ok: false, error: missing };

  const res = await evolutionRequest(
    config,
    `/instance/logout/${encodeURIComponent(config.instanceName)}`,
    { method: 'DELETE' }
  );
  if (!res.ok) return { ok: false, error: res.error || 'Logout failed' };
  return { ok: true };
}

export async function fetchConnectionState(config: WhatsAppConfig): Promise<{
  ok: boolean;
  state?: string;
  instance?: string;
  phone?: string;
  profileName?: string;
  error?: string;
}> {
  const missing = requireEvolutionConfig(config);
  if (missing) return { ok: false, error: missing };

  const [stateRes, info] = await Promise.all([
    evolutionRequest(
      config,
      `/instance/connectionState/${encodeURIComponent(config.instanceName)}`
    ),
    fetchInstanceInfo(config),
  ]);

  if (!stateRes.ok) {
    return { ok: false, error: stateRes.error || 'Connection check failed' };
  }

  const instance = stateRes.data.instance as Record<string, unknown> | undefined;
  const state = String(
    instance?.state ||
      stateRes.data.state ||
      stateRes.data.connectionStatus ||
      info.state ||
      'unknown'
  );
  return {
    ok: true,
    state,
    instance: config.instanceName,
    phone: info.phone,
    profileName: info.profileName,
  };
}

export async function findEvolutionWebhook(config: WhatsAppConfig): Promise<{
  ok: boolean;
  enabled?: boolean;
  url?: string;
  events?: string[];
  error?: string;
}> {
  if (!config.baseUrl || !config.apiKey || !config.instanceName) {
    return { ok: false, error: 'Evolution API not configured' };
  }

  const res = await evolutionRequest(
    config,
    `/webhook/find/${encodeURIComponent(config.instanceName)}`
  );
  if (!res.ok) return { ok: false, error: res.error || 'Webhook lookup failed' };

  const nested = res.data.webhook as Record<string, unknown> | undefined;
  const enabled = Boolean(res.data.enabled ?? nested?.enabled);
  const url = String(res.data.url ?? nested?.url ?? '');
  const events = (res.data.events ?? nested?.events) as string[] | undefined;
  return { ok: true, enabled, url: url || undefined, events };
}

export async function setEvolutionWebhook(
  config: WhatsAppConfig,
  webhookUrl: string
): Promise<{ ok: boolean; error?: string }> {
  if (!config.baseUrl || !config.apiKey || !config.instanceName) {
    return { ok: false, error: 'Evolution API not configured' };
  }

  const headers: Record<string, string> = {};
  if (config.webhookSecret) {
    headers['x-webhook-secret'] = config.webhookSecret;
  }

  const body: Record<string, unknown> = {
    enabled: true,
    url: webhookUrl,
    webhookByEvents: false,
    webhookBase64: true,
    events: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE'],
  };

  if (Object.keys(headers).length) {
    body.headers = headers;
  }

  const res = await evolutionRequest(
    config,
    `/webhook/set/${encodeURIComponent(config.instanceName)}`,
    { method: 'POST', body }
  );

  if (!res.ok) {
    const alt = await evolutionRequest(
      config,
      `/webhook/set/${encodeURIComponent(config.instanceName)}`,
      {
        method: 'POST',
        body: {
          webhook: {
            enabled: true,
            url: webhookUrl,
            byEvents: false,
            base64: true,
            headers,
            events: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE'],
          },
        },
      }
    );
    if (!alt.ok) return { ok: false, error: alt.error || res.error || 'Webhook registration failed' };
  }

  return { ok: true };
}

export async function sendTextMessage(
  config: WhatsAppConfig,
  phone: string,
  text: string
): Promise<{ ok: boolean; error?: string }> {
  if (!config.instanceName) {
    return { ok: false, error: 'Evolution API not configured' };
  }

  const res = await evolutionRequest(
    config,
    `/message/sendText/${encodeURIComponent(config.instanceName)}`,
    {
      method: 'POST',
      body: { number: phone.replace(/\D/g, ''), text },
    }
  );
  return res.ok ? { ok: true } : { ok: false, error: res.error || 'Send failed' };
}

export async function fetchMediaBase64(
  config: WhatsAppConfig,
  payload: unknown
): Promise<{ base64?: string; mimetype?: string; error?: string }> {
  if (!config.instanceName) {
    return { error: 'Evolution API not configured' };
  }

  const res = await evolutionRequest(
    config,
    `/chat/getBase64FromMediaMessage/${encodeURIComponent(config.instanceName)}`,
    { method: 'POST', body: { message: payload } }
  );
  if (!res.ok) return { error: res.error || 'Media fetch failed' };

  const nested = res.data.data as Record<string, unknown> | undefined;
  const base64 = (res.data.base64 || nested?.base64) as string | undefined;
  const mimetype = (res.data.mimetype || nested?.mimetype || 'application/octet-stream') as string;
  if (!base64) return { error: 'No media in response' };
  return { base64, mimetype };
}
