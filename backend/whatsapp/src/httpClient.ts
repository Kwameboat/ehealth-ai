import type { WhatsAppConfig } from './config';

export async function evolutionRequest(
  config: WhatsAppConfig,
  path: string,
  options: { method?: string; body?: unknown } = {}
): Promise<{ ok: boolean; status: number; data: Record<string, unknown>; error?: string }> {
  if (!config.baseUrl || !config.apiKey) {
    return { ok: false, status: 0, data: {}, error: 'Evolution API not configured' };
  }

  const url = `${config.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);

  try {
    const res = await fetch(url, {
      method: options.method || 'GET',
      headers: {
        apikey: config.apiKey,
        'Content-Type': 'application/json',
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });

    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      const msg = typeof data.message === 'string' ? data.message : `HTTP ${res.status}`;
      return { ok: false, status: res.status, data, error: msg };
    }
    return { ok: true, status: res.status, data };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Request failed';
    return { ok: false, status: 0, data: {}, error: message };
  } finally {
    clearTimeout(timer);
  }
}
