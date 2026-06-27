import type { WhatsAppConfig } from './config';

export interface WaButton {
  id: string;
  displayText: string;
}

export interface WaListRow {
  id: string;
  title: string;
  description?: string;
}

export async function sendButtonsMessage(
  config: WhatsAppConfig,
  phone: string,
  opts: { title: string; description: string; footer?: string; buttons: WaButton[] }
): Promise<{ ok: boolean; error?: string }> {
  try {
    const axios = (await import('axios')).default;
    if (!config.baseUrl || !config.apiKey || !config.instanceName) {
      return { ok: false, error: 'Evolution API not configured' };
    }
    await axios.post(
      `${config.baseUrl}/message/sendButtons/${encodeURIComponent(config.instanceName)}`,
      {
        number: phone.replace(/\D/g, ''),
        title: opts.title.slice(0, 60),
        description: opts.description.slice(0, 1024),
        footer: opts.footer?.slice(0, 60) || 'eHealth AI · Agyenim',
        buttons: opts.buttons.slice(0, 3).map((b) => ({
          type: 'reply',
          displayText: b.displayText.slice(0, 25),
          id: b.id.slice(0, 128),
        })),
      },
      { headers: { apikey: config.apiKey }, timeout: 45000 }
    );
    return { ok: true };
  } catch (err: unknown) {
    return { ok: false, error: err instanceof Error ? err.message : 'Buttons send failed' };
  }
}

export async function sendListMessage(
  config: WhatsAppConfig,
  phone: string,
  opts: { title: string; description: string; buttonText: string; rows: WaListRow[] }
): Promise<{ ok: boolean; error?: string }> {
  try {
    const axios = (await import('axios')).default;
    if (!config.baseUrl || !config.apiKey || !config.instanceName) {
      return { ok: false, error: 'Evolution API not configured' };
    }
    await axios.post(
      `${config.baseUrl}/message/sendList/${encodeURIComponent(config.instanceName)}`,
      {
        number: phone.replace(/\D/g, ''),
        title: opts.title.slice(0, 60),
        description: opts.description.slice(0, 1024),
        buttonText: opts.buttonText.slice(0, 20),
        footerText: 'eHealth AI',
        sections: [
          {
            title: 'Options',
            rows: opts.rows.slice(0, 10).map((r) => ({
              title: r.title.slice(0, 24),
              description: (r.description || '').slice(0, 72),
              rowId: r.id.slice(0, 128),
            })),
          },
        ],
      },
      { headers: { apikey: config.apiKey }, timeout: 45000 }
    );
    return { ok: true };
  } catch (err: unknown) {
    return { ok: false, error: err instanceof Error ? err.message : 'List send failed' };
  }
}
