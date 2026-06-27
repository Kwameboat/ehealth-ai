import type { WhatsAppDeps } from './deps';

export interface WaSession {
  id: string;
  userId: string;
  phone: string;
  sessionType: string;
  payload: Record<string, unknown>;
  expiresAt: string;
}

export function saveSession(
  deps: WhatsAppDeps,
  row: {
    userId: string;
    phone: string;
    sessionType: string;
    payload: Record<string, unknown>;
    ttlMinutes?: number;
  }
): string {
  const id = deps.uuid();
  const ts = deps.now();
  const ttl = row.ttlMinutes ?? 60;
  const expires = new Date(Date.now() + ttl * 60 * 1000).toISOString();
  deps
    .getDb()
    .prepare(
      `INSERT INTO wa_sessions (id, user_id, phone, session_type, payload, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(id, row.userId, row.phone, row.sessionType, JSON.stringify(row.payload), expires, ts);
  return id;
}

export function getSession(deps: WhatsAppDeps, id: string): WaSession | null {
  const row = deps.getDb().prepare(`SELECT * FROM wa_sessions WHERE id = ?`).get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  if (String(row.expires_at) < deps.now()) {
    deps.getDb().prepare(`DELETE FROM wa_sessions WHERE id = ?`).run(id);
    return null;
  }
  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(String(row.payload || '{}'));
  } catch {
    payload = {};
  }
  return {
    id: String(row.id),
    userId: String(row.user_id),
    phone: String(row.phone),
    sessionType: String(row.session_type),
    payload,
    expiresAt: String(row.expires_at),
  };
}

export function deleteSession(deps: WhatsAppDeps, id: string): void {
  deps.getDb().prepare(`DELETE FROM wa_sessions WHERE id = ?`).run(id);
}
