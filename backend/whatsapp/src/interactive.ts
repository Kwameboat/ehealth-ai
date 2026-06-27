import type { WhatsAppConfig } from './config';
import { evolutionRequest } from './httpClient';

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
  if (!config.instanceName) {
    return { ok: false, error: 'Evolution API not configured' };
  }

  const res = await evolutionRequest(
    config,
    `/message/sendButtons/${encodeURIComponent(config.instanceName)}`,
    {
      method: 'POST',
      body: {
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
    }
  );
  return res.ok ? { ok: true } : { ok: false, error: res.error || 'Buttons send failed' };
}

export async function sendListMessage(
  config: WhatsAppConfig,
  phone: string,
  opts: { title: string; description: string; buttonText: string; rows: WaListRow[] }
): Promise<{ ok: boolean; error?: string }> {
  if (!config.instanceName) {
    return { ok: false, error: 'Evolution API not configured' };
  }

  const res = await evolutionRequest(
    config,
    `/message/sendList/${encodeURIComponent(config.instanceName)}`,
    {
      method: 'POST',
      body: {
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
    }
  );
  return res.ok ? { ok: true } : { ok: false, error: res.error || 'List send failed' };
}
