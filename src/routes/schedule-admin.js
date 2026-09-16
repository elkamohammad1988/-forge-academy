/* Admin-only CRUD for the schedule. Persists to the schedule_classes table.
   The public /api/schedule reads from this table when populated, falling back
   to the static src/data/schedule.js seed.
*/
import { Router } from 'express';
import { z } from 'zod';
import { getDb, audit } from '../db.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();
router.use(requireAdmin);

const classSchema = z.object({
  day:      z.coerce.number().int().min(0).max(6),
  time:     z.string().regex(/^\d{2}:\d{2}$/),
  duration: z.coerce.number().int().min(15).max(240).default(60),
  prog:     z.enum(['BJJ', 'MuayThai', 'Boxing', 'Kids']),
  level:    z.string().max(40).default('All'),
  coach:    z.string().max(80).optional().or(z.literal('')),
  title:    z.string().min(1).max(120),
  capacity: z.coerce.number().int().min(0).max(500).default(20),
  active:   z.union([z.boolean(), z.literal(0), z.literal(1)]).optional(),
});

router.get('/', (_req, res) => {
  const rows = getDb().prepare(`
    SELECT * FROM schedule_classes ORDER BY day ASC, time ASC, id ASC
  `).all();
  res.json({ ok: true, classes: rows });
});

router.post('/', (req, res) => {
  const parsed = classSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ ok: false, error: 'Invalid input.', details: parsed.error.flatten() });
  const d = parsed.data;
  const r = getDb().prepare(`
    INSERT INTO schedule_classes (day, time, duration, prog, level, coach, title, capacity, active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(d.day, d.time, d.duration, d.prog, d.level, d.coach || null, d.title, d.capacity, d.active === false ? 0 : 1);
  audit({ actor: req.user.email, action: 'schedule.created', entity_id: r.lastInsertRowid, ip: req.ip });
  res.json({ ok: true, id: r.lastInsertRowid });
});

router.patch('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const parsed = classSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ ok: false, error: 'Invalid input.' });
  const d = parsed.data;
  const fields = []; const args = [];
  for (const [k, v] of Object.entries(d)) {
    if (v === undefined) continue;
    fields.push(`${k} = ?`);
    args.push(typeof v === 'boolean' ? (v ? 1 : 0) : v);
  }
  if (!fields.length) return res.json({ ok: true, changed: 0 });
  args.push(id);
  const r = getDb().prepare(`UPDATE schedule_classes SET ${fields.join(', ')} WHERE id = ?`).run(...args);
  audit({ actor: req.user.email, action: 'schedule.updated', entity_id: id, ip: req.ip });
  res.json({ ok: true, changed: r.changes });
});

router.delete('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const r = getDb().prepare(`DELETE FROM schedule_classes WHERE id = ?`).run(id);
  audit({ actor: req.user.email, action: 'schedule.deleted', entity_id: id, ip: req.ip });
  res.json({ ok: true, changed: r.changes });
});

router.post('/seed', (req, res) => {
  const force = req.query.force === '1';
  const db = getDb();
  const count = db.prepare('SELECT COUNT(*) AS c FROM schedule_classes').get().c;
  if (count > 0 && !force) {
    return res.status(409).json({ ok: false, error: 'Schedule is not empty. Pass ?force=1 to overwrite.' });
  }
  if (force) db.exec('DELETE FROM schedule_classes');
  // Re-seed from the static source of truth
  // (lazy import to avoid a startup cost if never used)
  import('../data/schedule.js').then(({ SCHEDULE }) => {
    const stmt = db.prepare(`
      INSERT INTO schedule_classes (day, time, duration, prog, level, coach, title, capacity, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);
    const tx = db.transaction((rows) => rows.forEach((c) => stmt.run(c.day, c.time, c.dur, c.prog, c.level, c.coach || null, c.title, 20)));
    tx(SCHEDULE);
    audit({ actor: req.user.email, action: 'schedule.seeded', meta: { count: SCHEDULE.length }, ip: req.ip });
    res.json({ ok: true, count: SCHEDULE.length });
  });
});

export default router;
