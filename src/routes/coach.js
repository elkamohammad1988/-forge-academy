import { Router } from 'express';
import { z } from 'zod';
import { randomBytes } from 'node:crypto';
import { getDb, audit } from '../db.js';
import { SCHEDULE } from '../data/schedule.js';
import { evaluateAchievements } from '../lib/achievements.js';

const router = Router();

// ─── Auth: must be coach or admin ──────────────────────────────────────────
function requireCoach(req, res, next) {
  if (!req.user) return res.status(401).json({ ok: false, error: 'Sign in required.' });
  if (!['coach', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ ok: false, error: 'Coach access only.' });
  }
  next();
}

// ─── Member: rotate & expose own check-in QR token ─────────────────────────
function requireMember(req, res, next) {
  if (!req.user) return res.status(401).json({ ok: false, error: 'Sign in required.' });
  next();
}

router.post('/me/checkin-token', requireMember, (req, res) => {
  const db = getDb();
  // Invalidate old, issue fresh — valid 24 hours
  db.prepare(`DELETE FROM checkin_tokens WHERE member_id = ? AND used_at IS NULL`).run(req.user.id);
  const token   = randomBytes(16).toString('base64url');
  const expires = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
  db.prepare(`INSERT INTO checkin_tokens (member_id, token, expires_at) VALUES (?, ?, ?)`)
    .run(req.user.id, token, expires);
  res.json({ ok: true, token, expiresAt: expires });
});

// ─── Coach: today's roster across all classes ──────────────────────────────
router.get('/roster', requireCoach, (req, res) => {
  const date = req.query.date || new Date().toISOString().slice(0, 10);
  const rows = getDb().prepare(`
    SELECT b.id AS booking_id, b.class_day, b.class_time, b.program, b.starts_at, b.status, b.waitlist_position,
           m.id AS member_id, m.email, m.first_name, m.last_name,
           a.status AS attendance, a.checked_in_at
    FROM bookings b
    LEFT JOIN members m ON m.id = b.member_id
    LEFT JOIN attendance a ON a.booking_id = b.id
    WHERE date(b.starts_at) = ? AND b.status IN ('confirmed','waitlist')
    ORDER BY b.starts_at ASC, b.waitlist_position ASC NULLS FIRST, m.last_name ASC
  `).all(date);

  // Group by class slot
  const byClass = {};
  for (const r of rows) {
    const key = `${r.class_day}|${r.class_time}|${r.starts_at}`;
    if (!byClass[key]) {
      const meta = SCHEDULE.find((c) => c.day === r.class_day && c.time === r.class_time);
      byClass[key] = {
        day: r.class_day, time: r.class_time, starts_at: r.starts_at,
        program: r.program, title: meta?.title || r.program, coach: meta?.coach || '',
        roster: [],
      };
    }
    byClass[key].roster.push({
      booking_id: r.booking_id, member_id: r.member_id,
      name: `${r.first_name || ''} ${r.last_name || ''}`.trim(),
      email: r.email, status: r.status,
      waitlist_position: r.waitlist_position,
      attendance: r.attendance, checked_in_at: r.checked_in_at,
    });
  }
  res.json({ ok: true, date, classes: Object.values(byClass) });
});

// ─── Coach: mark attendance for a booking ──────────────────────────────────
const markSchema = z.object({
  bookingId: z.coerce.number().int(),
  status:    z.enum(['attended', 'no-show', 'late', 'excused']),
  notes:     z.string().max(500).optional(),
});
router.post('/attendance', requireCoach, (req, res) => {
  const parsed = markSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ ok: false, error: 'Invalid input.' });
  const { bookingId, status, notes } = parsed.data;
  const db = getDb();
  const booking = db.prepare('SELECT id, member_id FROM bookings WHERE id = ?').get(bookingId);
  if (!booking) return res.status(404).json({ ok: false, error: 'Booking not found.' });
  db.prepare(`
    INSERT INTO attendance (booking_id, member_id, status, notes, checked_in_by)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(booking_id) DO UPDATE SET status = excluded.status, notes = excluded.notes,
                                          checked_in_at = datetime('now'), checked_in_by = excluded.checked_in_by
  `).run(bookingId, booking.member_id, status, notes || null, req.user.id);
  audit({ actor: req.user.email, action: 'attendance.' + status, entity: 'booking', entity_id: bookingId, ip: req.ip });
  if (booking.member_id && (status === 'attended' || status === 'late')) {
    try { evaluateAchievements(booking.member_id); } catch {}
  }
  res.json({ ok: true });
});

// ─── Coach: scan a QR / paste a token to mark a member as attended ─────────
const scanSchema = z.object({
  token:     z.string().min(8).max(64),
  bookingId: z.coerce.number().int().optional(),
});
router.post('/scan', requireCoach, (req, res) => {
  const parsed = scanSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ ok: false, error: 'Invalid input.' });
  const { token, bookingId } = parsed.data;
  const db = getDb();
  const row = db.prepare(`
    SELECT * FROM checkin_tokens
    WHERE token = ? AND used_at IS NULL AND expires_at > datetime('now')
  `).get(token);
  if (!row) return res.status(400).json({ ok: false, error: 'Token expired or invalid.' });

  // Find the booking — explicit override, or the next confirmed class today
  let booking;
  if (bookingId) {
    booking = db.prepare('SELECT * FROM bookings WHERE id = ? AND member_id = ?').get(bookingId, row.member_id);
  } else {
    booking = db.prepare(`
      SELECT * FROM bookings
      WHERE member_id = ? AND date(starts_at) = date('now') AND status = 'confirmed'
      ORDER BY abs(julianday(starts_at) - julianday('now')) ASC LIMIT 1
    `).get(row.member_id);
  }
  if (!booking) return res.status(404).json({ ok: false, error: 'No matching class today for that member.' });

  db.prepare(`
    INSERT INTO attendance (booking_id, member_id, status, checked_in_by)
    VALUES (?, ?, 'attended', ?)
    ON CONFLICT(booking_id) DO UPDATE SET status='attended', checked_in_at=datetime('now'), checked_in_by=excluded.checked_in_by
  `).run(booking.id, row.member_id, req.user.id);

  db.prepare('UPDATE checkin_tokens SET used_at = datetime(\'now\') WHERE id = ?').run(row.id);
  audit({ actor: req.user.email, action: 'attendance.scanned', entity: 'booking', entity_id: booking.id, ip: req.ip });
  try { evaluateAchievements(row.member_id); } catch {}

  const member = db.prepare('SELECT first_name, last_name FROM members WHERE id = ?').get(row.member_id);
  res.json({ ok: true, member, bookingId: booking.id, program: booking.program, time: booking.class_time });
});

// ─── Member: own attendance history ────────────────────────────────────────
router.get('/me/attendance', requireMember, (req, res) => {
  const rows = getDb().prepare(`
    SELECT b.starts_at, b.program, a.status, a.checked_in_at
    FROM bookings b
    JOIN attendance a ON a.booking_id = b.id
    WHERE b.member_id = ?
    ORDER BY b.starts_at DESC LIMIT 50
  `).all(req.user.id);
  res.json({ ok: true, attendance: rows });
});

export default router;
