import type { WhatsAppConfig } from '../config';
import type { WhatsAppDeps } from '../deps';
import type { PrescriptionExtract } from '../gemini';
import { sendButtonsMessage } from '../interactive';
import { saveSession } from '../sessionStore';

function computeNextFire(times: string[], from = new Date()): string {
  const candidates: Date[] = [];
  for (const t of times) {
    const [h, m] = t.split(':').map(Number);
    if (Number.isNaN(h)) continue;
    const d = new Date(from);
    d.setHours(h, m || 0, 0, 0);
    if (d <= from) d.setDate(d.getDate() + 1);
    candidates.push(d);
  }
  candidates.sort((a, b) => a.getTime() - b.getTime());
  return (candidates[0] || new Date(from.getTime() + 3600000)).toISOString();
}

export function createMedicationReminder(
  deps: WhatsAppDeps,
  row: {
    userId: string;
    profileId?: string | null;
    medicationName: string;
    dosageText: string;
    scheduleTimes: string[];
    durationDays?: number;
  }
): string {
  const id = deps.uuid();
  const ts = deps.now();
  const duration = row.durationDays ?? 7;
  const endsAt = new Date(Date.now() + duration * 86400000).toISOString();
  const nextFire = computeNextFire(row.scheduleTimes);

  deps
    .getDb()
    .prepare(
      `INSERT INTO medication_reminders
       (id, user_id, profile_id, medication_name, dosage_text, schedule_times, duration_days, ends_at, next_fire_at, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
    )
    .run(
      id,
      row.userId,
      row.profileId || null,
      row.medicationName,
      row.dosageText,
      JSON.stringify(row.scheduleTimes),
      duration,
      endsAt,
      nextFire,
      ts,
      ts
    );
  return id;
}

export async function offerReminderSetup(
  deps: WhatsAppDeps,
  config: WhatsAppConfig,
  phone: string,
  userId: string,
  extract: PrescriptionExtract
): Promise<void> {
  if (!extract.medicationName && !extract.dosageInstructions) return;

  const times = extract.suggestedTimes?.length ? extract.suggestedTimes : ['08:00', '20:00'];
  const sessionId = saveSession(deps, {
    userId,
    phone,
    sessionType: 'reminder_setup',
    payload: {
      medicationName: extract.medicationName || 'Medication',
      dosageText: extract.dosageInstructions || 'As prescribed',
      scheduleTimes: times,
      durationDays: extract.durationDays || 7,
      deliveryMedications: extract.deliveryMedications || [],
    },
    ttlMinutes: 120,
  });

  const timeLabel = times.join(' & ');
  await sendButtonsMessage(config, phone, {
    title: '💊 Medication Reminder',
    description: `I read: *${extract.medicationName || 'your medicine'}*\n${extract.dosageInstructions || ''}\n\nWould you like daily reminders at ${timeLabel}?`,
    buttons: [
      { id: `reminder_setup_yes:${sessionId}`, displayText: 'Yes, remind me ✅' },
      { id: `reminder_setup_no:${sessionId}`, displayText: 'Not now' },
    ],
  });
}

export function activateReminderFromSession(deps: WhatsAppDeps, sessionId: string, userId: string): string | null {
  const row = deps.getDb().prepare(`SELECT * FROM wa_sessions WHERE id = ?`).get(sessionId) as Record<string, unknown> | undefined;
  if (!row || String(row.user_id) !== userId) return null;
  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(String(row.payload));
  } catch {
    return null;
  }
  const times = Array.isArray(payload.scheduleTimes) ? payload.scheduleTimes.map(String) : ['08:00', '20:00'];
  const id = createMedicationReminder(deps, {
    userId,
    medicationName: String(payload.medicationName || 'Medication'),
    dosageText: String(payload.dosageText || 'As prescribed'),
    scheduleTimes: times,
    durationDays: Number(payload.durationDays) || 7,
  });
  deps.getDb().prepare(`DELETE FROM wa_sessions WHERE id = ?`).run(sessionId);
  return id;
}

export function markReminderTaken(deps: WhatsAppDeps, reminderId: string, userId: string): boolean {
  const r = deps.getDb().prepare(`SELECT * FROM medication_reminders WHERE id = ? AND user_id = ?`).get(reminderId, userId) as
    | Record<string, unknown>
    | undefined;
  if (!r) return false;
  const ts = deps.now();
  deps.getDb().prepare(`UPDATE medication_reminders SET adherence_count = adherence_count + 1, updated_at = ? WHERE id = ?`).run(ts, reminderId);
  deps
    .getDb()
    .prepare(`INSERT INTO reminder_events (id, reminder_id, user_id, event_type, created_at) VALUES (?, ?, ?, 'taken', ?)`)
    .run(deps.uuid(), reminderId, userId, ts);
  return true;
}

export function snoozeReminder(deps: WhatsAppDeps, reminderId: string, userId: string, minutes = 30): boolean {
  const r = deps.getDb().prepare(`SELECT * FROM medication_reminders WHERE id = ? AND user_id = ?`).get(reminderId, userId);
  if (!r) return false;
  const next = new Date(Date.now() + minutes * 60000).toISOString();
  const ts = deps.now();
  deps
    .getDb()
    .prepare(`UPDATE medication_reminders SET next_fire_at = ?, snooze_count = snooze_count + 1, updated_at = ? WHERE id = ?`)
    .run(next, ts, reminderId);
  deps
    .getDb()
    .prepare(`INSERT INTO reminder_events (id, reminder_id, user_id, event_type, created_at) VALUES (?, ?, ?, 'snooze', ?)`)
    .run(deps.uuid(), reminderId, userId, ts);
  return true;
}

export function advanceReminderSchedule(deps: WhatsAppDeps, reminderId: string): void {
  const r = deps.getDb().prepare(`SELECT * FROM medication_reminders WHERE id = ?`).get(reminderId) as Record<string, unknown> | undefined;
  if (!r) return;
  let times: string[] = [];
  try {
    times = JSON.parse(String(r.schedule_times || '[]'));
  } catch {
    times = ['08:00', '20:00'];
  }
  const next = computeNextFire(times, new Date());
  deps.getDb().prepare(`UPDATE medication_reminders SET next_fire_at = ?, last_sent_at = ?, updated_at = ? WHERE id = ?`).run(next, deps.now(), deps.now(), reminderId);
}

export { computeNextFire };
