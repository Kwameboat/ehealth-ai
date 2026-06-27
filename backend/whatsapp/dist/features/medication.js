"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMedicationReminder = createMedicationReminder;
exports.offerReminderSetup = offerReminderSetup;
exports.activateReminderFromSession = activateReminderFromSession;
exports.markReminderTaken = markReminderTaken;
exports.snoozeReminder = snoozeReminder;
exports.advanceReminderSchedule = advanceReminderSchedule;
exports.computeNextFire = computeNextFire;
const interactive_1 = require("../interactive");
const sessionStore_1 = require("../sessionStore");
function computeNextFire(times, from = new Date()) {
    const candidates = [];
    for (const t of times) {
        const [h, m] = t.split(':').map(Number);
        if (Number.isNaN(h))
            continue;
        const d = new Date(from);
        d.setHours(h, m || 0, 0, 0);
        if (d <= from)
            d.setDate(d.getDate() + 1);
        candidates.push(d);
    }
    candidates.sort((a, b) => a.getTime() - b.getTime());
    return (candidates[0] || new Date(from.getTime() + 3600000)).toISOString();
}
function createMedicationReminder(deps, row) {
    const id = deps.uuid();
    const ts = deps.now();
    const duration = row.durationDays ?? 7;
    const endsAt = new Date(Date.now() + duration * 86400000).toISOString();
    const nextFire = computeNextFire(row.scheduleTimes);
    deps
        .getDb()
        .prepare(`INSERT INTO medication_reminders
       (id, user_id, profile_id, medication_name, dosage_text, schedule_times, duration_days, ends_at, next_fire_at, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`)
        .run(id, row.userId, row.profileId || null, row.medicationName, row.dosageText, JSON.stringify(row.scheduleTimes), duration, endsAt, nextFire, ts, ts);
    return id;
}
async function offerReminderSetup(deps, config, phone, userId, extract) {
    if (!extract.medicationName && !extract.dosageInstructions)
        return;
    const times = extract.suggestedTimes?.length ? extract.suggestedTimes : ['08:00', '20:00'];
    const sessionId = (0, sessionStore_1.saveSession)(deps, {
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
    await (0, interactive_1.sendButtonsMessage)(config, phone, {
        title: '💊 Medication Reminder',
        description: `I read: *${extract.medicationName || 'your medicine'}*\n${extract.dosageInstructions || ''}\n\nWould you like daily reminders at ${timeLabel}?`,
        buttons: [
            { id: `reminder_setup_yes:${sessionId}`, displayText: 'Yes, remind me ✅' },
            { id: `reminder_setup_no:${sessionId}`, displayText: 'Not now' },
        ],
    });
}
function activateReminderFromSession(deps, sessionId, userId) {
    const row = deps.getDb().prepare(`SELECT * FROM wa_sessions WHERE id = ?`).get(sessionId);
    if (!row || String(row.user_id) !== userId)
        return null;
    let payload = {};
    try {
        payload = JSON.parse(String(row.payload));
    }
    catch {
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
function markReminderTaken(deps, reminderId, userId) {
    const r = deps.getDb().prepare(`SELECT * FROM medication_reminders WHERE id = ? AND user_id = ?`).get(reminderId, userId);
    if (!r)
        return false;
    const ts = deps.now();
    deps.getDb().prepare(`UPDATE medication_reminders SET adherence_count = adherence_count + 1, updated_at = ? WHERE id = ?`).run(ts, reminderId);
    deps
        .getDb()
        .prepare(`INSERT INTO reminder_events (id, reminder_id, user_id, event_type, created_at) VALUES (?, ?, ?, 'taken', ?)`)
        .run(deps.uuid(), reminderId, userId, ts);
    return true;
}
function snoozeReminder(deps, reminderId, userId, minutes = 30) {
    const r = deps.getDb().prepare(`SELECT * FROM medication_reminders WHERE id = ? AND user_id = ?`).get(reminderId, userId);
    if (!r)
        return false;
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
function advanceReminderSchedule(deps, reminderId) {
    const r = deps.getDb().prepare(`SELECT * FROM medication_reminders WHERE id = ?`).get(reminderId);
    if (!r)
        return;
    let times = [];
    try {
        times = JSON.parse(String(r.schedule_times || '[]'));
    }
    catch {
        times = ['08:00', '20:00'];
    }
    const next = computeNextFire(times, new Date());
    deps.getDb().prepare(`UPDATE medication_reminders SET next_fire_at = ?, last_sent_at = ?, updated_at = ? WHERE id = ?`).run(next, deps.now(), deps.now(), reminderId);
}
