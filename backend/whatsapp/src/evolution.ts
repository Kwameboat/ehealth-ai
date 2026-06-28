import type { WhatsAppConfig } from './config';
import { evolutionRequest } from './httpClient';
import { normalizePhone } from './phone';

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

function unwrapEvolutionPayload(data: Record<string, unknown>): Record<string, unknown> {
  const nested = data.data;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    return { ...data, ...(nested as Record<string, unknown>) };
  }
  const response = data.response;
  if (response && typeof response === 'object' && !Array.isArray(response)) {
    return { ...data, ...(response as Record<string, unknown>) };
  }
  return data;
}

function looksLikePairingCode(value: string): boolean {
  const v = value.trim();
  if (/^[A-Z0-9]{4}-[A-Z0-9]{4}$/i.test(v)) return true;
  const clean = v.replace(/\W/g, '');
  if (/^[A-Z0-9]{8}$/i.test(clean)) return true;
  if (/^\d{8}$/.test(clean)) return true;
  return false;
}

function formatPairingCode(value: string): string {
  const clean = value.replace(/\W/g, '').toUpperCase();
  if (clean.length === 8) return `${clean.slice(0, 4)}-${clean.slice(4)}`;
  return value.trim().toUpperCase();
}

function asPairingString(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return formatPairingCode(String(Math.trunc(value)).padStart(8, '0'));
  }
  if (typeof value === 'string' && looksLikePairingCode(value)) {
    return formatPairingCode(value);
  }
  return undefined;
}

function extractPairingCode(root: Record<string, unknown>, qrcode: Record<string, unknown> | string | undefined): string | undefined {
  const candidates: unknown[] = [
    root.pairingCode,
    root.linkCode,
    root.pairing_code,
    root.pin,
    root.connectionCode,
    typeof qrcode === 'object' && qrcode ? qrcode.pairingCode : undefined,
    typeof qrcode === 'object' && qrcode ? qrcode.linkCode : undefined,
    typeof qrcode === 'object' && qrcode ? qrcode.code : undefined,
  ];
  if (typeof root.code === 'string' && looksLikePairingCode(root.code)) {
    candidates.push(root.code);
  }
  for (const c of candidates) {
    const formatted = asPairingString(c);
    if (formatted) return formatted;
  }
  return undefined;
}

function deepFindPairingCode(value: unknown, depth = 0): string | undefined {
  if (depth > 8 || value === null || value === undefined) return undefined;
  if (typeof value === 'string' || typeof value === 'number') {
    return asPairingString(value);
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = deepFindPairingCode(item, depth + 1);
      if (found) return found;
    }
    return undefined;
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    for (const [key, val] of Object.entries(obj)) {
      if (/pair|link|pin|code/i.test(key)) {
        const formatted = asPairingString(val);
        if (formatted) return formatted;
      }
    }
    for (const val of Object.values(obj)) {
      const found = deepFindPairingCode(val, depth + 1);
      if (found) return found;
    }
  }
  return undefined;
}

function looksLikeWhatsAppQrCode(value: string): boolean {
  return value.startsWith('2@') || value.length > 40;
}

async function qrDataUrlFromCode(rawCode: string): Promise<string | undefined> {
  try {
    // Lazy load — optional on cPanel when install-backend-deps.sh omits qrcode
    const QRCode = require('qrcode') as typeof import('qrcode');
    return await QRCode.toDataURL(rawCode, { width: 280, margin: 1 });
  } catch {
    return undefined;
  }
}

async function parseConnectPayload(data: Record<string, unknown>): Promise<{
  qrBase64?: string;
  qrCode?: string;
  pairingCode?: string;
  state?: string;
}> {
  const root = unwrapEvolutionPayload(data);
  const qrcode = root.qrcode as Record<string, unknown> | string | undefined;
  const instance = root.instance as Record<string, unknown> | undefined;

  let base64 =
    (typeof root.base64 === 'string' && root.base64) ||
    (typeof root.base64Image === 'string' && root.base64Image) ||
    (typeof qrcode === 'object' && qrcode && typeof qrcode.base64 === 'string' && qrcode.base64) ||
    (typeof qrcode === 'object' && qrcode && typeof qrcode.base64Image === 'string' && qrcode.base64Image) ||
    (typeof root.qr === 'string' && root.qr) ||
    undefined;

  const rawCode =
    (typeof root.code === 'string' && looksLikeWhatsAppQrCode(root.code) && root.code) ||
    (typeof qrcode === 'object' && qrcode && typeof qrcode.code === 'string' && qrcode.code) ||
    (typeof qrcode === 'string' && qrcode) ||
    undefined;

  if (!base64 && rawCode) {
    base64 = await qrDataUrlFromCode(rawCode);
  }

  const pairingCode = extractPairingCode(root, qrcode) || deepFindPairingCode(root);

  const state =
    (typeof instance?.status === 'string' && instance.status) ||
    (typeof instance?.state === 'string' && instance.state) ||
    (typeof root.state === 'string' && root.state) ||
    undefined;

  return {
    qrBase64: base64 ? normalizeQrBase64(base64) : undefined,
    qrCode: rawCode,
    pairingCode,
    state,
  };
}

function normalizeQrBase64(value: string): string {
  if (value.startsWith('data:image')) return value;
  return `data:image/png;base64,${value.replace(/^data:image\/[a-z]+;base64,/, '')}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestEvolutionConnect(
  config: WhatsAppConfig,
  method: 'GET' | 'POST',
  phone?: string
): Promise<{ ok: boolean; data: Record<string, unknown>; error?: string }> {
  const digits = phone ? normalizePhone(phone) : undefined;
  const path = `/instance/connect/${encodeURIComponent(config.instanceName)}`;

  if (method === 'GET') {
    const query = digits ? `?number=${encodeURIComponent(digits)}` : '';
    const res = await evolutionRequest(config, `${path}${query}`);
    return res.ok ? { ok: true, data: res.data } : { ok: false, data: res.data, error: res.error };
  }

  const res = await evolutionRequest(config, path, {
    method: 'POST',
    body: digits
      ? {
          number: digits,
          instanceName: config.instanceName,
          phoneNumber: digits,
        }
      : {},
  });
  return res.ok ? { ok: true, data: res.data } : { ok: false, data: res.data, error: res.error };
}

function hasQrPayload(parsed: { qrBase64?: string; qrCode?: string; pairingCode?: string }): boolean {
  return !!(parsed.qrBase64 || parsed.qrCode || parsed.pairingCode);
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

export async function createEvolutionInstance(
  config: WhatsAppConfig,
  phone?: string
): Promise<{
  ok: boolean;
  created?: boolean;
  qrBase64?: string;
  qrCode?: string;
  pairingCode?: string;
  state?: string;
  error?: string;
}> {
  const missing = requireEvolutionConfig(config);
  if (missing) return { ok: false, error: missing };

  const digits = phone ? normalizePhone(phone) : undefined;
  const res = await evolutionRequest(config, '/instance/create', {
    method: 'POST',
    body: {
      instanceName: config.instanceName,
      integration: 'WHATSAPP-BAILEYS',
      qrcode: true,
      ...(digits ? { number: digits } : {}),
    },
  });

  if (!res.ok) {
    const msg = (res.error || '').toLowerCase();
    if (msg.includes('already') || msg.includes('exist')) {
      return connectEvolutionInstance(config, phone);
    }
    return { ok: false, error: res.error || 'Instance creation failed' };
  }

  const parsed = await parseConnectPayload(res.data);
  return { ok: true, created: true, ...parsed };
}

export async function connectEvolutionInstance(
  config: WhatsAppConfig,
  phone?: string
): Promise<{
  ok: boolean;
  qrBase64?: string;
  qrCode?: string;
  pairingCode?: string;
  state?: string;
  error?: string;
}> {
  const missing = requireEvolutionConfig(config);
  if (missing) return { ok: false, error: missing };

  let lastError: string | undefined;
  let best: Awaited<ReturnType<typeof parseConnectPayload>> = {};

  for (const method of ['GET', 'POST'] as const) {
    const res = await requestEvolutionConnect(config, method, phone);
    if (!res.ok) {
      lastError = res.error;
      continue;
    }
    const parsed = await parseConnectPayload(res.data);
    if (hasQrPayload(parsed)) return { ok: true, ...parsed };
    best = parsed;
  }

  if (best.qrBase64 || best.qrCode || best.pairingCode || best.state) {
    return { ok: true, ...best };
  }

  return { ok: false, error: lastError || 'Connect failed — Evolution returned no QR code' };
}

export async function fetchEvolutionQrWithRetry(
  config: WhatsAppConfig,
  phone?: string,
  opts: { maxAttempts?: number; delayMs?: number } = {}
): Promise<{
  ok: boolean;
  qrBase64?: string;
  qrCode?: string;
  pairingCode?: string;
  state?: string;
  error?: string;
  created?: boolean;
}> {
  const maxAttempts = opts.maxAttempts ?? 8;
  const delayMs = opts.delayMs ?? 1500;
  let lastError: string | undefined;
  let lastState: string | undefined;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    let result = await connectEvolutionInstance(config, phone);
    if (!result.ok && !phone) {
      const info = await fetchInstanceInfo(config);
      if (!info.exists) {
        const created = await createEvolutionInstance(config);
        if (created.ok) {
          if (hasQrPayload(created)) return created;
          result = created;
        } else {
          lastError = created.error;
        }
      }
    }

    if (result.ok) {
      lastState = result.state;
      if (hasQrPayload(result)) return result;
      lastError = result.error;
    } else {
      lastError = result.error;
    }

    if (phone) break;
    if (attempt < maxAttempts - 1) await sleep(delayMs);
  }

  return {
    ok: true,
    state: lastState || 'connecting',
    error: lastError || 'Evolution did not return a QR code — check API key and instance name',
  };
}

export async function fetchEvolutionPairingWithRetry(
  config: WhatsAppConfig,
  phone: string,
  opts: { maxAttempts?: number; delayMs?: number } = {}
): Promise<{
  ok: boolean;
  pairingCode?: string;
  qrBase64?: string;
  state?: string;
  phone?: string;
  error?: string;
}> {
  const missing = requireEvolutionConfig(config);
  if (missing) return { ok: false, error: missing };

  const digits = normalizePhone(phone);
  if (!digits || digits.length < 11) {
    return {
      ok: false,
      error: 'Enter a valid Ghana number (e.g. 0501234567 or 233501234567)',
    };
  }

  const maxAttempts = opts.maxAttempts ?? 8;
  const delayMs = opts.delayMs ?? 2000;
  let lastError: string | undefined;

  const conn = await fetchConnectionState(config);
  const connState = String(conn.state || 'close').toLowerCase();
  if (connState === 'connecting') {
    await logoutEvolutionInstance(config);
    await sleep(1500);
  }

  const info = await fetchInstanceInfo(config);
  if (!info.exists) {
    const created = await createEvolutionInstance(config, digits);
    if (created.ok && created.pairingCode) {
      return { ok: true, pairingCode: created.pairingCode, state: created.state, phone: digits };
    }
    if (!created.ok) lastError = created.error;
    await sleep(1000);
  }

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const method = attempt < 5 ? 'GET' : 'POST';
    const res = await requestEvolutionConnect(config, method, digits);
    if (res.ok) {
      const parsed = await parseConnectPayload(res.data);
      if (parsed.pairingCode) {
        return {
          ok: true,
          pairingCode: parsed.pairingCode,
          qrBase64: parsed.qrBase64,
          state: parsed.state,
          phone: digits,
        };
      }
      lastError = `Evolution responded but no link code (attempt ${attempt + 1}/${maxAttempts})`;
    } else {
      lastError = res.error;
    }

    if (attempt === 2 && !info.exists) {
      const alt = await evolutionRequest(config, '/instance/create', {
        method: 'POST',
        body: {
          instanceName: config.instanceName,
          integration: 'WHATSAPP-BAILEYS',
          number: digits,
          qrcode: false,
        },
      });
      if (alt.ok) {
        const parsed = await parseConnectPayload(alt.data);
        if (parsed.pairingCode) {
          return { ok: true, pairingCode: parsed.pairingCode, state: parsed.state, phone: digits };
        }
      }
    }

    if (attempt < maxAttempts - 1) await sleep(delayMs);
  }

  return {
    ok: false,
    error:
      lastError ||
      'Could not get WhatsApp link code — confirm number is on WhatsApp and Evolution API key is correct',
  };
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
