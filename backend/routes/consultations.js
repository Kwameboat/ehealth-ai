const express = require('express');
const { getDb, uuid, now } = require('../db/init');
const { requireUserAuth } = require('../middleware/userAuth');
const { deductPoints, PointsError } = require('../services/points');

const router = express.Router();

const JITSI_BASE = process.env.JITSI_MEET_URL || 'https://meet.jit.si';

function mapDoctor(row) {
  return {
    id: row.id,
    fullName: row.full_name,
    specialty: row.specialty,
    bio: row.bio,
    photoUrl: row.photo_url,
    hospitalAffiliation: row.hospital_affiliation,
    consultationFeeKobo: row.consultation_fee_kobo,
    pointsCost: row.points_cost,
    slotDurationMin: row.slot_duration_min,
  };
}

function buildVideoUrl(doctor, consultationId) {
  if (doctor.meet_url) return doctor.meet_url;
  const slug = doctor.video_room_slug || `ehealth-${doctor.id.slice(0, 8)}`;
  return `${JITSI_BASE}/${slug}-${consultationId.slice(0, 8)}`;
}

router.get('/doctors', requireUserAuth, (req, res) => {
  const rows = getDb()
    .prepare(`SELECT * FROM doctors WHERE is_active = 1 ORDER BY sort_order, full_name`)
    .all();
  res.json({ doctors: rows.map(mapDoctor) });
});

router.get('/doctors/:id', requireUserAuth, (req, res) => {
  const row = getDb().prepare(`SELECT * FROM doctors WHERE id = ? AND is_active = 1`).get(req.params.id);
  if (!row) return res.status(404).json({ error: { message: 'Doctor not found' } });
  const availability = getDb()
    .prepare(
      `SELECT id, day_of_week, start_time, end_time FROM doctor_availability
       WHERE doctor_id = ? AND is_active = 1 ORDER BY day_of_week, start_time`
    )
    .all(req.params.id);
  res.json({
    doctor: mapDoctor(row),
    availability: availability.map((a) => ({
      id: a.id,
      dayOfWeek: a.day_of_week,
      startTime: a.start_time,
      endTime: a.end_time,
    })),
  });
});

router.get('/doctors/:id/slots', requireUserAuth, (req, res) => {
  const doctor = getDb().prepare(`SELECT * FROM doctors WHERE id = ? AND is_active = 1`).get(req.params.id);
  if (!doctor) return res.status(404).json({ error: { message: 'Doctor not found' } });

  const dateStr = req.query.date || new Date().toISOString().slice(0, 10);
  const dayOfWeek = new Date(`${dateStr}T12:00:00`).getDay();
  const avail = getDb()
    .prepare(
      `SELECT * FROM doctor_availability WHERE doctor_id = ? AND day_of_week = ? AND is_active = 1`
    )
    .all(req.params.id, dayOfWeek);

  const booked = getDb()
    .prepare(
      `SELECT scheduled_at FROM consultations
       WHERE doctor_id = ? AND date(scheduled_at) = date(?) AND status IN ('pending', 'confirmed')`
    )
    .all(req.params.id, dateStr);

  const bookedSet = new Set(booked.map((b) => b.scheduled_at));
  const duration = doctor.slot_duration_min || 30;
  const slots = [];

  for (const block of avail) {
    const [sh, sm] = block.start_time.split(':').map(Number);
    const [eh, em] = block.end_time.split(':').map(Number);
    let cursor = new Date(`${dateStr}T${String(sh).padStart(2, '0')}:${String(sm || 0).padStart(2, '0')}:00`);
    const end = new Date(`${dateStr}T${String(eh).padStart(2, '0')}:${String(em || 0).padStart(2, '0')}:00`);
    while (cursor.getTime() + duration * 60000 <= end.getTime()) {
      const iso = cursor.toISOString();
      if (cursor > new Date() && !bookedSet.has(iso)) {
        slots.push({
          scheduledAt: iso,
          label: cursor.toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit' }),
        });
      }
      cursor = new Date(cursor.getTime() + duration * 60000);
    }
  }

  res.json({ date: dateStr, slots, durationMin: duration });
});

router.post('/consultations/book', requireUserAuth, (req, res) => {
  try {
    const { doctorId, scheduledAt, chiefComplaint } = req.body || {};
    if (!doctorId || !scheduledAt) {
      return res.status(400).json({ error: { message: 'doctorId and scheduledAt required' } });
    }
    const doctor = getDb().prepare(`SELECT * FROM doctors WHERE id = ? AND is_active = 1`).get(doctorId);
    if (!doctor) return res.status(404).json({ error: { message: 'Doctor not found' } });

    const conflict = getDb()
      .prepare(
        `SELECT id FROM consultations WHERE doctor_id = ? AND scheduled_at = ? AND status IN ('pending', 'confirmed')`
      )
      .get(doctorId, scheduledAt);
    if (conflict) return res.status(409).json({ error: { message: 'Slot already booked' } });

    const deduction = deductPoints(req.userId, 'video_consultation');
    const id = uuid();
    const ts = now();
    const videoUrl = buildVideoUrl(doctor, id);

    getDb()
      .prepare(
        `INSERT INTO consultations
         (id, user_id, doctor_id, scheduled_at, duration_min, status, chief_complaint, video_url, meeting_id, points_charged, amount_kobo, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'confirmed', ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        req.userId,
        doctorId,
        scheduledAt,
        doctor.slot_duration_min || 30,
        chiefComplaint || null,
        videoUrl,
        id.slice(0, 8),
        deduction.charged,
        doctor.consultation_fee_kobo,
        ts,
        ts
      );

    const consultation = getDb().prepare(`SELECT * FROM consultations WHERE id = ?`).get(id);
    res.status(201).json({
      consultation: mapConsultation(consultation, doctor),
      points: { charged: deduction.charged, balance: deduction.balance },
    });
  } catch (e) {
    if (e instanceof PointsError) {
      return res.status(e.status).json({ error: { message: e.message, code: e.code } });
    }
    res.status(500).json({ error: { message: e.message } });
  }
});

router.get('/consultations/mine', requireUserAuth, (req, res) => {
  const rows = getDb()
    .prepare(
      `SELECT c.*, d.full_name, d.specialty, d.photo_url
       FROM consultations c
       JOIN doctors d ON d.id = c.doctor_id
       WHERE c.user_id = ?
       ORDER BY c.scheduled_at DESC LIMIT 50`
    )
    .all(req.userId);
  res.json({
    consultations: rows.map((r) => ({
      ...mapConsultation(r, { full_name: r.full_name, specialty: r.specialty, photo_url: r.photo_url }),
    })),
  });
});

router.post('/consultations/:id/cancel', requireUserAuth, (req, res) => {
  const row = getDb()
    .prepare(`SELECT * FROM consultations WHERE id = ? AND user_id = ?`)
    .get(req.params.id, req.userId);
  if (!row) return res.status(404).json({ error: { message: 'Consultation not found' } });
  if (row.status === 'completed' || row.status === 'cancelled') {
    return res.status(400).json({ error: { message: 'Cannot cancel this consultation' } });
  }
  getDb()
    .prepare(`UPDATE consultations SET status = 'cancelled', updated_at = ? WHERE id = ?`)
    .run(now(), req.params.id);
  res.json({ success: true });
});

function mapConsultation(c, doctor) {
  return {
    id: c.id,
    doctorId: c.doctor_id,
    doctorName: doctor?.full_name,
    specialty: doctor?.specialty,
    photoUrl: doctor?.photo_url,
    scheduledAt: c.scheduled_at,
    durationMin: c.duration_min,
    status: c.status,
    chiefComplaint: c.chief_complaint,
    videoUrl: c.video_url,
    meetingId: c.meeting_id,
    pointsCharged: c.points_charged,
    createdAt: c.created_at,
  };
}

module.exports = router;
