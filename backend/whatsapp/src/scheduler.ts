import type { WhatsAppConfig } from './config';
import type { WhatsAppDeps } from './deps';
import { getWhatsAppConfig } from './config';
import { sendReminderPrompt } from './buttonHandler';
import { advanceReminderSchedule } from './features/medication';
import { sendTextMessage } from './evolution';
import { getUpcomingFamilyReminders } from './features/family';

const TIPS = [
  '🌅 Good morning! Drink water first thing — it helps blood pressure.',
  '🥗 Try kontomire or garden egg stew today for extra fibre.',
  '🚶 A 15-minute walk after meals helps control blood sugar.',
  '🧂 Reduce shito and salty seasonings if you have hypertension.',
];

export function startWhatsAppScheduler(deps: WhatsAppDeps): void {
  const tick = async () => {
    try {
      if (deps.ensureDbReady) await deps.ensureDbReady();
      const config = getWhatsAppConfig(deps);
      if (!config.enabled || !config.baseUrl) return;

      await fireDueReminders(deps, config);
      await sendTuesdayBpPrompts(deps, config);
      await sendMorningTips(deps, config);
      await sendFamilyCareNotes(deps, config);
    } catch (err) {
      console.error('[whatsapp-scheduler]', err);
    }
  };

  setInterval(tick, 60 * 1000);
  setTimeout(tick, 5000);
  console.log('[whatsapp] scheduler started');
}

async function fireDueReminders(deps: WhatsAppDeps, config: WhatsAppConfig) {
  const now = deps.now();
  const due = deps
    .getDb()
    .prepare(
      `SELECT r.*, u.phone FROM medication_reminders r
       JOIN users u ON u.id = r.user_id
       WHERE r.is_active = 1 AND r.next_fire_at IS NOT NULL AND r.next_fire_at <= ?
       AND u.phone IS NOT NULL AND u.phone != ''`
    )
    .all(now) as Array<Record<string, unknown>>;

  for (const row of due) {
    const phone = String(row.phone).replace(/\D/g, '');
    const id = String(row.id);
    await sendReminderPrompt(config, phone, id, String(row.medication_name), String(row.dosage_text));
    advanceReminderSchedule(deps, id);
  }
}

async function sendTuesdayBpPrompts(deps: WhatsAppDeps, config: WhatsAppConfig) {
  if (new Date().getDay() !== 2) return;
  if (new Date().getHours() !== 8) return;

  const key = 'wa_bp_prompt_' + new Date().toISOString().slice(0, 10);
  if (deps.getSetting(key, '') === 'sent') return;

  const users = deps
    .getDb()
    .prepare(`SELECT phone FROM users WHERE phone IS NOT NULL AND phone != '' AND is_active = 1`)
    .all() as Array<{ phone: string }>;

  for (const u of users) {
    await sendTextMessage(config, u.phone, '🩺 *Tuesday BP check*\nLog your blood pressure: reply *BP: 120/80*');
  }
  deps.setSetting(key, 'sent');
}

async function sendMorningTips(deps: WhatsAppDeps, config: WhatsAppConfig) {
  if (new Date().getHours() !== 7) return;
  const key = 'wa_morning_tip_' + new Date().toISOString().slice(0, 10);
  if (deps.getSetting(key, '') === 'sent') return;

  const tip = TIPS[Math.floor(Math.random() * TIPS.length)];
  const users = deps
    .getDb()
    .prepare(`SELECT phone FROM users WHERE phone IS NOT NULL AND phone != '' AND is_active = 1 LIMIT 200`)
    .all() as Array<{ phone: string }>;

  for (const u of users) {
    await sendTextMessage(config, u.phone, tip);
  }
  deps.setSetting(key, 'sent');
}

async function sendFamilyCareNotes(deps: WhatsAppDeps, config: WhatsAppConfig) {
  if (new Date().getHours() !== 9) return;
  const key = 'wa_family_notes_' + new Date().toISOString().slice(0, 10);
  if (deps.getSetting(key, '') === 'sent') return;

  const owners = deps
    .getDb()
    .prepare(`SELECT DISTINCT owner_user_id FROM family_profiles WHERE is_active = 1`)
    .all() as Array<{ owner_user_id: string }>;

  for (const o of owners) {
    const u = deps.getDb().prepare(`SELECT phone FROM users WHERE id = ?`).get(o.owner_user_id) as { phone?: string } | undefined;
    if (!u?.phone) continue;
    const notes = getUpcomingFamilyReminders(deps, o.owner_user_id);
    if (notes.length) {
      await sendTextMessage(config, u.phone, notes.join('\n'));
    }
  }
  deps.setSetting(key, 'sent');
}
