import { Router } from 'express';
import { getDb, audit } from '../db.js';
import { bookingSchema } from '../lib/validators.js';
import { requireMember } from '../middleware/auth.js';
import { requireSignedWaiver } from '../middleware/waiver.js';
import { findClass } from '../data/load-schedule.js';
import { dispatch as dispatchWebhook } from '../lib/webhooks.js';

const router = Router();
router.use(requireMember);

const DEFAULT_CAPACITY = 20;

function capacityFor(day, time) {
  const override = getDb()
    .prepare('SELECT capacity FROM class_capacity WHERE class_day = ? AND class_time = ?')
    .get(day, time);
  return override ? override.capacity : DEFAULT_CAPACITY;
}

function nextOccurrence(day, time) {
  const now = new Date();
  const [h, m] = time.split(':').map(Number);
  const d = new Date(now);
  let diff = (day - d.getDay() + 7) % 7;
  d.setHours(h, m, 0, 0);
  if (diff === 0 && d <= now) diff = 7;
  d.setDate(d.getDate() + diff);
  return d.toISOString();
}

router.get('/', (req, res) => {
  const rows = getDb().prepare(`
    SELECT * FROM bookings
    WHERE member_id = ? AND starts_at >= datetime('now', '-2 hours')
    ORDER BY starts_at ASC
  `).all(req.user.id);
  res.json({ ok: true, bookings: rows });
});

router.post('/', requireSignedWaiver, (req, res) => {
  const parsed = bookingSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ ok: false, error: 'Invalid booking.' });
  const { classDay, classTime, program } = parsed.data;
  const exists = findClass(classDay, classTime);
  if (!exists) return res.status(404).json({ ok: false, error: 'Class not found.' });

  const startsAt = nextOccurrence(classDay, classTime);
  const db = getDb();

  // Already booked?
  const dup = db.prepare(`
    SELECT id FROM bookings
    WHERE member_id = ? AND class_day = ? AND class_time = ? AND starts_at = ? AND status IN ('confirmed','waitlist')
  `).get(req.user.id, classDay, classTime, startsAt);
  if (dup) return res.status(409).json({ ok: false, error: 'You\'re already on the list for this class.' });

  // Capacity check (in-transaction to avoid races)
  const result = db.transaction(() => {
    const capacity = capacityFor(classDay, classTime);
    const confirmed = db.prepare(`
      SELECT COUNT(*) AS c FROM bookings
      WHERE class_day = ? AND class_time = ? AND starts_at = ? AND status = 'confirmed'
    `).get(classDay, classTime, startsAt).c;

    if (confirmed < capacity) {
      const r = db.prepare(`
        INSERT INTO bookings (member_id, class_day, class_time, program, starts_at, status)
        VALUES (?, ?, ?, ?, ?, 'confirmed')
      `).run(req.user.id, classDay, classTime, program, startsAt);
      return { id: r.lastInsertRowid, status: 'confirmed', position: null };
    }

    // Class full → waitlist
    const waitlistAhead = db.prepare(`
      SELECT COUNT(*) AS c FROM bookings
      WHERE class_day = ? AND class_time = ? AND starts_at = ? AND status = 'waitlist'
    `).get(classDay, classTime, startsAt).c;
    const r = db.prepare(`
      INSERT INTO bookings (member_id, class_day, class_time, program, starts_at, status, waitlist_position)
      VALUES (?, ?, ?, ?, ?, 'waitlist', ?)
    `).run(req.user.id, classDay, classTime, program, startsAt, waitlistAhead + 1);
    return { id: r.lastInsertRowid, status: 'waitlist', position: waitlistAhead + 1 };
  })();

  audit({ actor: req.user.email, action: `booking.${result.status}`, entity_id: result.id, ip: req.ip });
  dispatchWebhook(result.status === 'waitlist' ? 'booking.waitlisted' : 'booking.confirmed', {
    id: result.id, member_id: req.user.id, member_email: req.user.email,
    classDay, classTime, program, starts_at: startsAt, position: result.position,
  });
  res.json({ ok: true, ...result, starts_at: startsAt });
});

router.delete('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const db = getDb();
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ? AND member_id = ?').get(id, req.user.id);
  if (!booking) return res.status(404).json({ ok: false, error: 'Not found.' });

  db.transaction(() => {
    db.prepare('UPDATE bookings SET status = ? WHERE id = ?').run('cancelled', id);
    // Promote the first waitlisted member if we just freed a spot
    if (booking.status === 'confirmed') {
      const next = db.prepare(`
        SELECT id FROM bookings
        WHERE class_day = ? AND class_time = ? AND starts_at = ? AND status = 'waitlist'
        ORDER BY waitlist_position ASC LIMIT 1
      `).get(booking.class_day, booking.class_time, booking.starts_at);
      if (next) {
        db.prepare(`UPDATE bookings SET status = 'confirmed', waitlist_position = NULL WHERE id = ?`).run(next.id);
      }
    }
  })();

  audit({ actor: req.user.email, action: 'booking.cancelled', entity_id: id, ip: req.ip });
  dispatchWebhook('booking.cancelled', { id, member_email: req.user.email });
  res.json({ ok: true });
});

export default router;
