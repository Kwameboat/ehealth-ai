const express = require('express');
const { getDb, uuid, now } = require('../db/init');
const { requireUserAuth } = require('../middleware/userAuth');
const { ensureRouteDatabase } = require('../middleware/requestDb');
const { deductPoints, PointsError } = require('../services/points');
const {
  answerNhisQuestion,
  answerDietQuestion,
  parseBloodPressure,
  bpInterpretation,
} = require('../services/healthAssistant');
const { findNearbyFacilities } = require('../services/nearbyPlaces');
const { initializeTransaction } = require('../services/paystack');
const { analyzeMedicineImage, analyzePrescriptionImage } = require('../services/visionAssist');

const router = express.Router();
router.use((req, res, next) => ensureRouteDatabase(req, res, next, 15_000));
router.use(requireUserAuth);

function handlePointsError(res, e, userId, featureKey) {
  if (e instanceof PointsError) {
    return res.status(e.status).json({
      error: { message: e.message, code: e.code },
    });
  }
  return null;
}

router.post('/health/nhis', async (req, res) => {
  try {
    const question = String(req.body?.question || '').trim();
    const history = Array.isArray(req.body?.history) ? req.body.history : [];
    if (!question) return res.status(400).json({ error: { message: 'Question is required' } });
    const answer = await answerNhisQuestion(question, history);
    const deduction = deductPoints(req.userId, 'pwa_nhis');
    res.setHeader('X-Health-Engine', '2');
    res.json({ answer, points: { charged: deduction.charged, balance: deduction.balance } });
  } catch (e) {
    const handled = handlePointsError(res, e, req.userId, 'pwa_nhis');
    if (handled) return handled;
    res.status(500).json({ error: { message: e.message } });
  }
});

router.post('/health/diet', async (req, res) => {
  try {
    const question = String(req.body?.question || '').trim();
    const history = Array.isArray(req.body?.history) ? req.body.history : [];
    if (!question) return res.status(400).json({ error: { message: 'Question is required' } });
    const answer = await answerDietQuestion(question, history);
    const deduction = deductPoints(req.userId, 'pwa_diet');
    res.setHeader('X-Health-Engine', '2');
    res.json({ answer, points: { charged: deduction.charged, balance: deduction.balance } });
  } catch (e) {
    const handled = handlePointsError(res, e, req.userId, 'pwa_diet');
    if (handled) return handled;
    res.status(500).json({ error: { message: e.message } });
  }
});

router.post('/health/medicine/scan', async (req, res) => {
  try {
    const { base64, mimeType } = req.body || {};
    if (!base64) return res.status(400).json({ error: { message: 'Image required' } });
    const deduction = deductPoints(req.userId, 'medicine_scan');
    const result = await analyzeMedicineImage(base64, mimeType || 'image/jpeg');
    res.json({ result, points: { charged: deduction.charged, balance: deduction.balance } });
  } catch (e) {
    const handled = handlePointsError(res, e, req.userId, 'medicine_scan');
    if (handled) return handled;
    res.status(500).json({ error: { message: e.message } });
  }
});

router.post('/health/prescription/analyze', async (req, res) => {
  try {
    const { base64, mimeType, caption } = req.body || {};
    if (!base64) return res.status(400).json({ error: { message: 'Image required' } });
    const deduction = deductPoints(req.userId, 'chat_image');
    const result = await analyzePrescriptionImage(base64, mimeType || 'image/jpeg', caption || '');
    res.json({ result, points: { charged: deduction.charged, balance: deduction.balance } });
  } catch (e) {
    const handled = handlePointsError(res, e, req.userId, 'chat_image');
    if (handled) return handled;
    res.status(500).json({ error: { message: e.message } });
  }
});

router.post('/health/bp', (req, res) => {
  try {
    const { systolic, diastolic, valueText, profileId } = req.body || {};
    let parsed =
      Number.isFinite(systolic) && Number.isFinite(diastolic)
        ? { systolic: Number(systolic), diastolic: Number(diastolic), valueText: `${systolic}/${diastolic}` }
        : parseBloodPressure(valueText || '');
    if (!parsed) {
      return res.status(400).json({ error: { message: 'Enter BP as 120/80 or systolic/diastolic numbers' } });
    }
    const ts = now();
    const id = uuid();
    getDb()
      .prepare(
        `INSERT INTO health_tracker_logs (id, user_id, profile_id, tracker_type, value_text, value_numeric, created_at)
         VALUES (?, ?, ?, 'blood_pressure', ?, ?, ?)`
      )
      .run(id, req.userId, profileId || null, parsed.valueText, parsed.systolic, ts);
    res.json({
      log: { id, valueText: parsed.valueText, createdAt: ts },
      note: bpInterpretation(parsed.systolic, parsed.diastolic),
    });
  } catch (e) {
    res.status(500).json({ error: { message: e.message } });
  }
});

router.get('/health/bp', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 30, 100);
  const rows = getDb()
    .prepare(
      `SELECT id, value_text, value_numeric, profile_id, created_at
       FROM health_tracker_logs
       WHERE user_id = ? AND tracker_type = 'blood_pressure'
       ORDER BY created_at DESC LIMIT ?`
    )
    .all(req.userId, limit);
  res.json({
    logs: rows.map((r) => ({
      id: r.id,
      valueText: r.value_text,
      systolic: r.value_numeric,
      profileId: r.profile_id,
      createdAt: r.created_at,
    })),
  });
});

router.get('/health/reminders', (req, res) => {
  const rows = getDb()
    .prepare(
      `SELECT * FROM medication_reminders WHERE user_id = ? AND is_active = 1 ORDER BY next_fire_at`
    )
    .all(req.userId);
  res.json({
    reminders: rows.map(mapReminder),
  });
});

router.post('/health/reminders', (req, res) => {
  try {
    const { medicationName, dosageText, scheduleTimes, durationDays, profileId } = req.body || {};
    if (!medicationName || !String(medicationName).trim()) {
      return res.status(400).json({ error: { message: 'medicationName required' } });
    }
    const times = Array.isArray(scheduleTimes) && scheduleTimes.length ? scheduleTimes.map(String) : ['08:00', '20:00'];
    const duration = Number(durationDays) || 7;
    const id = uuid();
    const ts = now();
    const endsAt = new Date(Date.now() + duration * 86400000).toISOString();
    const nextFire = computeNextFire(times);
    getDb()
      .prepare(
        `INSERT INTO medication_reminders
         (id, user_id, profile_id, medication_name, dosage_text, schedule_times, duration_days, ends_at, next_fire_at, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
      )
      .run(
        id,
        req.userId,
        profileId || null,
        String(medicationName).trim(),
        dosageText || 'As prescribed',
        JSON.stringify(times),
        duration,
        endsAt,
        nextFire,
        ts,
        ts
      );
    const row = getDb().prepare(`SELECT * FROM medication_reminders WHERE id = ?`).get(id);
    res.status(201).json({ reminder: mapReminder(row) });
  } catch (e) {
    res.status(500).json({ error: { message: e.message } });
  }
});

router.post('/health/reminders/:id/taken', (req, res) => {
  const row = getDb()
    .prepare(`SELECT * FROM medication_reminders WHERE id = ? AND user_id = ?`)
    .get(req.params.id, req.userId);
  if (!row) return res.status(404).json({ error: { message: 'Reminder not found' } });
  const ts = now();
  getDb()
    .prepare(`UPDATE medication_reminders SET adherence_count = adherence_count + 1, updated_at = ? WHERE id = ?`)
    .run(ts, req.params.id);
  getDb()
    .prepare(`INSERT INTO reminder_events (id, reminder_id, user_id, event_type, created_at) VALUES (?, ?, ?, 'taken', ?)`)
    .run(uuid(), req.params.id, req.userId, ts);
  res.json({ success: true });
});

router.post('/health/reminders/:id/snooze', (req, res) => {
  const row = getDb()
    .prepare(`SELECT * FROM medication_reminders WHERE id = ? AND user_id = ?`)
    .get(req.params.id, req.userId);
  if (!row) return res.status(404).json({ error: { message: 'Reminder not found' } });
  const minutes = Math.min(Number(req.body?.minutes) || 30, 240);
  const next = new Date(Date.now() + minutes * 60000).toISOString();
  const ts = now();
  getDb()
    .prepare(`UPDATE medication_reminders SET next_fire_at = ?, snooze_count = snooze_count + 1, updated_at = ? WHERE id = ?`)
    .run(next, ts, req.params.id);
  getDb()
    .prepare(`INSERT INTO reminder_events (id, reminder_id, user_id, event_type, created_at) VALUES (?, ?, ?, 'snooze', ?)`)
    .run(uuid(), req.params.id, req.userId, ts);
  res.json({ success: true, nextFireAt: next });
});

router.delete('/health/reminders/:id', (req, res) => {
  const row = getDb()
    .prepare(`SELECT id FROM medication_reminders WHERE id = ? AND user_id = ?`)
    .get(req.params.id, req.userId);
  if (!row) return res.status(404).json({ error: { message: 'Reminder not found' } });
  getDb()
    .prepare(`UPDATE medication_reminders SET is_active = 0, updated_at = ? WHERE id = ?`)
    .run(now(), req.params.id);
  res.json({ success: true });
});

router.get('/health/facilities/nearby', async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lon = parseFloat(req.query.lon);
    const type = String(req.query.type || 'pharmacy');
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return res.status(400).json({ error: { message: 'Valid lat and lon required' } });
    }
    deductPoints(req.userId, 'pwa_facility');
    const result = await findNearbyFacilities({
      latitude: lat,
      longitude: lon,
      type,
      radiusMeters: 15000,
      limit: 8,
    });
    res.json({ success: true, ...result });
  } catch (e) {
    const handled = handlePointsError(res, e, req.userId, 'pwa_facility');
    if (handled) return handled;
    res.status(502).json({ error: { message: e.message }, places: [] });
  }
});

router.post('/health/delivery/order', async (req, res) => {
  try {
    const medicationName = String(req.body?.medicationName || '').trim();
    const amountKobo = Number(req.body?.amountKobo) || 4500;
    if (!medicationName) return res.status(400).json({ error: { message: 'medicationName required' } });

    const user = getDb().prepare(`SELECT email FROM users WHERE id = ?`).get(req.userId);
    const reference = `pwa_del_${uuid().replace(/-/g, '').slice(0, 16)}`;
    const pay = await initializeTransaction({
      email: user?.email || `${req.userId}@ehealthaigh.com`,
      amountMinor: amountKobo,
      currency: 'GHS',
      reference,
      metadata: { userId: req.userId, medicationName, source: 'pwa_delivery' },
    });

    const orderId = uuid();
    const ts = now();
    getDb()
      .prepare(
        `INSERT INTO wa_delivery_orders (id, user_id, medication_name, amount_kobo, currency, paystack_reference, paystack_url, status, created_at)
         VALUES (?, ?, ?, ?, 'GHS', ?, ?, 'pending', ?)`
      )
      .run(orderId, req.userId, medicationName, amountKobo, reference, pay.authorization_url || '', ts);

    res.json({
      orderId,
      paymentUrl: pay.authorization_url,
      reference,
      medicationName,
      amountKobo,
    });
  } catch (e) {
    res.status(500).json({ error: { message: e.message } });
  }
});

router.get('/health/broadcasts', (req, res) => {
  const rows = getDb()
    .prepare(
      `SELECT b.id, b.title, b.message, b.created_at,
              CASE WHEN r.id IS NOT NULL THEN 1 ELSE 0 END AS is_read
       FROM health_broadcasts b
       LEFT JOIN health_broadcast_reads r ON r.broadcast_id = b.id AND r.user_id = ?
       ORDER BY b.created_at DESC LIMIT 50`
    )
    .all(req.userId);
  res.json({
    broadcasts: rows.map((b) => ({
      id: b.id,
      title: b.title,
      message: b.message,
      createdAt: b.created_at,
      isRead: !!b.is_read,
    })),
    unreadCount: rows.filter((b) => !b.is_read).length,
  });
});

router.post('/health/broadcasts/:id/read', (req, res) => {
  const broadcast = getDb().prepare(`SELECT id FROM health_broadcasts WHERE id = ?`).get(req.params.id);
  if (!broadcast) return res.status(404).json({ error: { message: 'Not found' } });
  getDb()
    .prepare(
      `INSERT OR IGNORE INTO health_broadcast_reads (id, broadcast_id, user_id, read_at) VALUES (?, ?, ?, ?)`
    )
    .run(uuid(), req.params.id, req.userId, now());
  res.json({ success: true });
});

function mapReminder(r) {
  let scheduleTimes = [];
  try {
    scheduleTimes = JSON.parse(r.schedule_times || '[]');
  } catch {
    scheduleTimes = [];
  }
  return {
    id: r.id,
    medicationName: r.medication_name,
    dosageText: r.dosage_text,
    scheduleTimes,
    durationDays: r.duration_days,
    endsAt: r.ends_at,
    nextFireAt: r.next_fire_at,
    adherenceCount: r.adherence_count,
    snoozeCount: r.snooze_count,
    profileId: r.profile_id,
    isActive: !!r.is_active,
    createdAt: r.created_at,
  };
}

function computeNextFire(times, from = new Date()) {
  const candidates = [];
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

module.exports = router;
