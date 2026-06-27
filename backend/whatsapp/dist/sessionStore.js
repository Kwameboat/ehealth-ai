"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveSession = saveSession;
exports.getSession = getSession;
exports.deleteSession = deleteSession;
function saveSession(deps, row) {
    const id = deps.uuid();
    const ts = deps.now();
    const ttl = row.ttlMinutes ?? 60;
    const expires = new Date(Date.now() + ttl * 60 * 1000).toISOString();
    deps
        .getDb()
        .prepare(`INSERT INTO wa_sessions (id, user_id, phone, session_type, payload, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .run(id, row.userId, row.phone, row.sessionType, JSON.stringify(row.payload), expires, ts);
    return id;
}
function getSession(deps, id) {
    const row = deps.getDb().prepare(`SELECT * FROM wa_sessions WHERE id = ?`).get(id);
    if (!row)
        return null;
    if (String(row.expires_at) < deps.now()) {
        deps.getDb().prepare(`DELETE FROM wa_sessions WHERE id = ?`).run(id);
        return null;
    }
    let payload = {};
    try {
        payload = JSON.parse(String(row.payload || '{}'));
    }
    catch {
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
function deleteSession(deps, id) {
    deps.getDb().prepare(`DELETE FROM wa_sessions WHERE id = ?`).run(id);
}
