import axios, { type AxiosInstance } from 'axios';
import type { WhatsAppConfig } from './config';

function client(config: WhatsAppConfig): AxiosInstance | null {
  if (!config.baseUrl || !config.apiKey) return null;
  return axios.create({
    baseURL: config.baseUrl,
    headers: { apikey: config.apiKey, 'Content-Type': 'application/json' },
    timeout: 45000,
  });
}

export async function fetchConnectionState(config: WhatsAppConfig): Promise<{
  ok: boolean;
  state?: string;
  instance?: string;
  error?: string;
}> {
  try {
    const http = client(config);
    if (!http || !config.instanceName) {
      return { ok: false, error: 'Evolution API URL, key, or instance name not configured' };
    }
    const res = await http.get(`/instance/connectionState/${encodeURIComponent(config.instanceName)}`);
    const state =
      res.data?.instance?.state ||
      res.data?.state ||
      res.data?.connectionStatus ||
      'unknown';
    return { ok: true, state: String(state), instance: config.instanceName };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Connection check failed';
    return { ok: false, error: message };
  }
}

export async function sendTextMessage(
  config: WhatsAppConfig,
  phone: string,
  text: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const http = client(config);
    if (!http || !config.instanceName) {
      return { ok: false, error: 'Evolution API not configured' };
    }
    await http.post(`/message/sendText/${encodeURIComponent(config.instanceName)}`, {
      number: phone.replace(/\D/g, ''),
      text,
    });
    return { ok: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Send failed';
    return { ok: false, error: message };
  }
}

export async function fetchMediaBase64(
  config: WhatsAppConfig,
  payload: unknown
): Promise<{ base64?: string; mimetype?: string; error?: string }> {
  try {
    const http = client(config);
    if (!http || !config.instanceName) {
      return { error: 'Evolution API not configured' };
    }
    const res = await http.post(
      `/chat/getBase64FromMediaMessage/${encodeURIComponent(config.instanceName)}`,
      { message: payload }
    );
    const base64 = res.data?.base64 || res.data?.data?.base64;
    const mimetype = res.data?.mimetype || res.data?.data?.mimetype || 'application/octet-stream';
    if (!base64) return { error: 'No media in response' };
    return { base64, mimetype };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : 'Media fetch failed' };
  }
}
