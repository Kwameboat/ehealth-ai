import type { WhatsAppDeps } from './deps';

export interface LogEntry {
  id: string;
  userId: string | null;
  phone: string;
  messageType: string;
  featureKey: string | null;
  pointsCharged: number;
  status: string;
  payloadPreview: string | null;
  responsePreview: string | null;
  createdAt: string;
}

export function insertWhatsAppLog(
  deps: WhatsAppDeps,
  row: Omit<LogEntry, 'id' | 'createdAt'> & { id?: string; createdAt?: string }
): void {
  const id = row.id || deps.uuid();
  const createdAt = row.createdAt || deps.now();
  deps
    .getDb()
    .prepare(
      `INSERT INTO whatsapp_logs
       (id, user_id, phone, message_type, feature_key, points_charged, status, payload_preview, response_preview, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      row.userId,
      row.phone,
      row.messageType,
      row.featureKey,
      row.pointsCharged,
      row.status,
      row.payloadPreview,
      row.responsePreview,
      createdAt
    );
}

export function listWhatsAppLogs(deps: WhatsAppDeps, limit = 100): LogEntry[] {
  const cap = Math.min(Math.max(limit, 1), 500);
  const rows = deps
    .getDb()
    .prepare(
      `SELECT l.*, u.email, u.full_name
       FROM whatsapp_logs l
       LEFT JOIN users u ON u.id = l.user_id
       ORDER BY l.created_at DESC
       LIMIT ?`
    )
    .all(cap) as Array<Record<string, unknown>>;

  return rows.map((r) => ({
    id: String(r.id),
    userId: r.user_id ? String(r.user_id) : null,
    phone: String(r.phone),
    messageType: String(r.message_type),
    featureKey: r.feature_key ? String(r.feature_key) : null,
    pointsCharged: Number(r.points_charged) || 0,
    status: String(r.status),
    payloadPreview: r.payload_preview ? String(r.payload_preview) : null,
    responsePreview: r.response_preview ? String(r.response_preview) : null,
    createdAt: String(r.created_at),
    email: r.email ? String(r.email) : null,
    fullName: r.full_name ? String(r.full_name) : null,
  })) as LogEntry[];
}

export function findUserByPhone(deps: WhatsAppDeps, phone: string) {
  const normalized = phone.replace(/\D/g, '');
  const users = deps.getDb().prepare(`SELECT * FROM users WHERE phone IS NOT NULL AND phone != ''`).all() as Array<{
    id: string;
    phone: string;
    points_balance: number;
    is_active: number;
    full_name?: string;
    email?: string;
  }>;

  for (const user of users) {
    const up = String(user.phone).replace(/\D/g, '');
    if (up === normalized || up.endsWith(normalized) || normalized.endsWith(up)) {
      return user;
    }
  }
  return null;
}

export function listRegisteredPhones(deps: WhatsAppDeps): string[] {
  const rows = deps
    .getDb()
    .prepare(`SELECT phone FROM users WHERE phone IS NOT NULL AND phone != '' AND is_active = 1`)
    .all() as Array<{ phone: string }>;
  return rows.map((r) => String(r.phone).replace(/\D/g, '')).filter(Boolean);
}

function preview(text: string, max = 180): string {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

export { preview };
