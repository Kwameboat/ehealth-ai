import type { WhatsAppDeps } from '../deps';

export interface FamilyProfile {
  id: string;
  displayName: string;
  relationship: string | null;
  phone: string | null;
  conditions: string | null;
}

export function listFamilyProfiles(deps: WhatsAppDeps, ownerUserId: string): FamilyProfile[] {
  const rows = deps
    .getDb()
    .prepare(`SELECT * FROM family_profiles WHERE owner_user_id = ? AND is_active = 1 ORDER BY display_name`)
    .all(ownerUserId) as Array<Record<string, unknown>>;
  return rows.map((r) => ({
    id: String(r.id),
    displayName: String(r.display_name),
    relationship: r.relationship ? String(r.relationship) : null,
    phone: r.phone ? String(r.phone) : null,
    conditions: r.conditions ? String(r.conditions) : null,
  }));
}

export function createFamilyProfile(
  deps: WhatsAppDeps,
  ownerUserId: string,
  displayName: string,
  relationship?: string
): string {
  const id = deps.uuid();
  const ts = deps.now();
  deps
    .getDb()
    .prepare(
      `INSERT INTO family_profiles (id, owner_user_id, display_name, relationship, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, 1, ?, ?)`
    )
    .run(id, ownerUserId, displayName.trim(), relationship?.trim() || null, ts, ts);
  return id;
}

export function formatFamilyList(profiles: FamilyProfile[]): string {
  if (!profiles.length) {
    return 'No family profiles yet.\n\nTo add one, say: *Add family Grandma Ayensu* or use the eHealth app Account screen.';
  }
  const lines = profiles.map((p, i) => `${i + 1}. *${p.displayName}*${p.relationship ? ` (${p.relationship})` : ''}`);
  return `👨‍👩‍👧‍👦 *Family Health Profiles*\n\n${lines.join('\n')}\n\nUpload their lab results or ask diet questions mentioning their name.`;
}

export function parseFamilyAddCommand(text: string): { name: string; relationship?: string } | null {
  const m = text.match(/add family\s+(.+)/i);
  if (!m) return null;
  const parts = m[1].trim().split(/\s+/);
  if (parts.length >= 2 && /^(mother|father|grandma|grandpa|child|spouse|aunt|uncle|dependent)$/i.test(parts[parts.length - 1])) {
    return { name: parts.slice(0, -1).join(' '), relationship: parts[parts.length - 1] };
  }
  return { name: m[1].trim() };
}

export function getUpcomingFamilyReminders(deps: WhatsAppDeps, ownerUserId: string): string[] {
  const profiles = listFamilyProfiles(deps, ownerUserId);
  const messages: string[] = [];
  for (const p of profiles) {
    const reminders = deps
      .getDb()
      .prepare(
        `SELECT medication_name, next_fire_at FROM medication_reminders
         WHERE profile_id = ? AND is_active = 1 AND next_fire_at IS NOT NULL
         ORDER BY next_fire_at LIMIT 1`
      )
      .all(p.id) as Array<{ medication_name: string; next_fire_at: string }>;
    if (reminders.length) {
      const r = reminders[0];
      const when = new Date(r.next_fire_at);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      if (when.toDateString() === tomorrow.toDateString()) {
        messages.push(`Hi, don't forget *${p.displayName}* has *${r.medication_name}* due tomorrow.`);
      }
    }
  }
  return messages;
}
