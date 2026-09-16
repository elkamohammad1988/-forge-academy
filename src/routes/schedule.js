import { Router } from 'express';
import { loadSchedule } from '../data/load-schedule.js';
import { getDb } from '../db.js';

const router = Router();

const DEFAULT_CAPACITY = 20;

function capacityFor(day, time) {
  // First prefer per-class capacity from schedule_classes, then class_capacity overrides
  const cls = getDb()
    .prepare('SELECT capacity FROM schedule_classes WHERE day = ? AND time = ? AND active = 1 LIMIT 1')
    .get(day, time);
  if (cls) return cls.capacity;
  const override = getDb()
    .prepare('SELECT capacity FROM class_capacity WHERE class_day = ? AND class_time = ?')
    .get(day, time);
  return override ? override.capacity : DEFAULT_CAPACITY;
}

function nextOccurrenceISO(day, time, from = new Date()) {
  const [h, m] = time.split(':').map(Number);
  const d = new Date(from);
  let diff = (day - d.getDay() + 7) % 7;
  d.setHours(h, m, 0, 0);
  if (diff === 0 && d <= from) diff = 7;
  d.setDate(d.getDate() + diff);
  return d.toISOString();
}

function attendanceFor(day, time) {
  const startsAt = nextOccurrenceISO(day, time);
  const row = getDb()
    .prepare(`SELECT COUNT(*) AS c FROM bookings WHERE class_day = ? AND class_time = ? AND starts_at = ? AND status = 'confirmed'`)
    .get(day, time, startsAt);
  return { booked: row.c, starts_at: startsAt };
}

function decorate(c) {
  const cap   = capacityFor(c.day, c.time);
  const att   = attendanceFor(c.day, c.time);
  return {
    ...c,
    capacity: cap,
    booked:   att.booked,
    spots_left: Math.max(0, cap - att.booked),
    starts_at: att.starts_at,
  };
}

router.get('/', (_req, res) => {
  const decorated = loadSchedule().map(decorate);
  res.json({ ok: true, schedule: decorated });
});

router.get('/next', (_req, res) => {
  const SCHED = loadSchedule();
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const probe = new Date(now);
  for (let i = 0; i < 8; i++) {
    const d = probe.getDay();
    const dayClasses = SCHED.filter((c) => c.day === d).sort((a, b) => a.time.localeCompare(b.time));
    for (const cls of dayClasses) {
      const [h, m] = cls.time.split(':').map(Number);
      const startMin = h * 60 + m;
      if (i === 0 && startMin <= minutes) continue;
      const when = new Date(probe);
      when.setHours(h, m, 0, 0);
      return res.json({ ok: true, next: { ...decorate(cls), starts_at: when.toISOString() } });
    }
    probe.setDate(probe.getDate() + 1);
  }
  res.json({ ok: true, next: null });
});

export default router;
