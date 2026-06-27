import type { WhatsAppConfig } from './config';
import { evolutionRequest } from './httpClient';

export async function fetchConnectionState(config: WhatsAppConfig): Promise<{
  ok: boolean;
  state?: string;
  instance?: string;
  error?: string;
}> {
  if (!config.instanceName) {
    return { ok: false, error: 'Evolution API URL, key, or instance name not configured' };
  }

  const res = await evolutionRequest(
    config,
    `/instance/connectionState/${encodeURIComponent(config.instanceName)}`
  );
  if (!res.ok) return { ok: false, error: res.error || 'Connection check failed' };

  const instance = res.data.instance as Record<string, unknown> | undefined;
  const state =
    instance?.state ||
    res.data.state ||
    res.data.connectionStatus ||
    'unknown';
  return { ok: true, state: String(state), instance: config.instanceName };
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
