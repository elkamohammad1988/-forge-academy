import { Router } from 'express';
import { z } from 'zod';
import { getDb, audit } from '../db.js';
import { requireAdmin } from '../middleware/auth.js';
import { sendMail } from '../lib/email.js';

const router = Router();
router.use(requireAdmin);

router.get('/stats', (_req, res) => {
  const db = getDb();
  const stats = {
    leads_total:    db.prepare('SELECT COUNT(*) AS c FROM leads').get().c,
    leads_today:    db.prepare(`SELECT COUNT(*) AS c FROM leads WHERE created_at >= date('now')`).get().c,
    leads_week:     db.prepare(`SELECT COUNT(*) AS c FROM leads WHERE created_at >= date('now','-7 days')`).get().c,
    leads_new:      db.prepare(`SELECT COUNT(*) AS c FROM leads WHERE status = 'new'`).get().c,
    contacts_total: db.prepare('SELECT COUNT(*) AS c FROM contacts').get().c,
    members_total:  db.prepare('SELECT COUNT(*) AS c FROM members').get().c,
    members_paid:   db.prepare(`SELECT COUNT(*) AS c FROM members WHERE plan IS NOT NULL`).get().c,
    bookings_today: db.prepare(`SELECT COUNT(*) AS c FROM bookings WHERE date(starts_at) = date('now') AND status = 'confirmed'`).get().c,
    newsletter_active: db.prepare('SELECT COUNT(*) AS c FROM newsletter WHERE unsubscribed_at IS NULL').get().c,
  };
  // Time-series (last 30 days)
  const series = db.prepare(`
    SELECT date(created_at) AS d, COUNT(*) AS c
    FROM leads
    WHERE created_at >= date('now','-30 days')
    GROUP BY date(created_at) ORDER BY d ASC
  `).all();
  res.json({ ok: true, stats, leads_30d: series });
});

router.get('/leads', (req, res) => {
  const limit  = Math.min(parseInt(req.query.limit,  10) || 50, 200);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
  const status = req.query.status;
  const q      = String(req.query.q || '').trim();
  const where = []; const args = [];
  if (status) { where.push('status = ?'); args.push(status); }
  if (q) {
    where.push('(first_name LIKE ? OR last_name LIKE ? OR email LIKE ? OR phone LIKE ?)');
    const like = '%' + q.replace(/[%_]/g, '\\$&') + '%';
    args.push(like, like, like, like);
  }
  const whereSql = where.length ? ' WHERE ' + where.join(' AND ') : '';
  const total = getDb().prepare('SELECT COUNT(*) AS c FROM leads' + whereSql).get(...args).c;
  args.push(limit, offset);
  const rows = getDb().prepare('SELECT * FROM leads' + whereSql + ' ORDER BY created_at DESC LIMIT ? OFFSET ?').all(...args);
  res.json({ ok: true, leads: rows, total, limit, offset });
});

router.get('/leads/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const lead  = getDb().prepare('SELECT * FROM leads WHERE id = ?').get(id);
  if (!lead) return res.status(404).json({ ok: false, error: 'Not found.' });
  const notes = getDb().prepare('SELECT * FROM lead_notes WHERE lead_id = ? ORDER BY created_at DESC').all(id);
  res.json({ ok: true, lead, notes });
});

router.patch('/leads/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const status = String(req.body?.status || '').trim();
  if (!['new', 'contacted', 'booked', 'closed', 'spam'].includes(status)) {
    return res.status(422).json({ ok: false, error: 'Invalid status.' });
  }
  const r = getDb().prepare('UPDATE leads SET status = ? WHERE id = ?').run(status, id);
  audit({ actor: req.user.email, action: 'lead.status.updated', entity_id: id, meta: { status }, ip: req.ip });
  res.json({ ok: true, changed: r.changes });
});

const noteSchema = z.object({ body: z.string().trim().min(1).max(2000) });
router.post('/leads/:id/notes', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const parsed = noteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ ok: false, error: 'Invalid note.' });
  const r = getDb().prepare(`
    INSERT INTO lead_notes (lead_id, author, body) VALUES (?, ?, ?)
  `).run(id, req.user.email, parsed.data.body);
  audit({ actor: req.user.email, action: 'lead.note.added', entity_id: r.lastInsertRowid, ip: req.ip });
  res.json({ ok: true, id: r.lastInsertRowid });
});

router.get('/contacts', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
  const rows = getDb().prepare('SELECT * FROM contacts ORDER BY created_at DESC LIMIT ?').all(limit);
  res.json({ ok: true, contacts: rows });
});

router.get('/members', (_req, res) => {
  const rows = getDb().prepare(`
    SELECT id, email, first_name, last_name, plan, role, email_verified_at, created_at, last_login_at
    FROM members ORDER BY created_at DESC LIMIT 200
  `).all();
  res.json({ ok: true, members: rows });
});

router.patch('/members/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const role = String(req.body?.role || '').trim();
  if (!['member', 'coach', 'admin'].includes(role)) return res.status(422).json({ ok: false, error: 'Invalid role.' });
  if (id === req.user.id && role !== 'admin') {
    return res.status(400).json({ ok: false, error: 'You can\'t demote yourself.' });
  }
  getDb().prepare('UPDATE members SET role = ? WHERE id = ?').run(role, id);
  audit({ actor: req.user.email, action: 'member.role.updated', entity_id: id, meta: { role }, ip: req.ip });
  res.json({ ok: true });
});

router.get('/leads.csv', (_req, res) => {
  const rows = getDb().prepare('SELECT * FROM leads ORDER BY created_at DESC').all();
  const cols = ['id','first_name','last_name','email','phone','program','preferred_day','preferred_time','status','created_at'];
  const escape = (v) => {
    if (v == null) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [cols.join(',')].concat(rows.map((r) => cols.map((c) => escape(r[c])).join(','))).join('\r\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="forge-leads-${Date.now()}.csv"`);
  res.send(csv);
});

// ─── Newsletter broadcast ──────────────────────────────────────────────────
const broadcastSchema = z.object({
  subject: z.string().trim().min(2).max(200),
  body:    z.string().trim().min(10).max(20000),
  test:    z.boolean().optional(),
});

router.post('/newsletter/broadcast', async (req, res) => {
  const parsed = broadcastSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ ok: false, error: 'Invalid input.', details: parsed.error.flatten() });
  const { subject, body, test } = parsed.data;
  const db = getDb();
  const recipients = test
    ? [{ email: req.user.email }]
    : db.prepare('SELECT email FROM newsletter WHERE unsubscribed_at IS NULL').all();

  const base = (process.env.PUBLIC_URL || '').replace(/\/$/, '');
  const wrapped = (email) => `${body}\n\n— Forge Manchester\n\nUnsubscribe: ${base}/api/newsletter/unsubscribe?email=${encodeURIComponent(email)}`;

  let sent = 0;
  for (const r of recipients) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await sendMail({ to: r.email, subject, text: wrapped(r.email) });
      sent++;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('broadcast send failed', r.email, e.message);
    }
  }
  audit({ actor: req.user.email, action: 'newsletter.broadcast', meta: { sent, test: !!test }, ip: req.ip });
  res.json({ ok: true, sent, total: recipients.length });
});

// ─── Capacity overrides ────────────────────────────────────────────────────
const capacitySchema = z.object({
  classDay:  z.coerce.number().int().min(0).max(6),
  classTime: z.string().regex(/^\d{2}:\d{2}$/),
  capacity:  z.coerce.number().int().min(0).max(500),
});

router.put('/capacity', (req, res) => {
  const parsed = capacitySchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ ok: false, error: 'Invalid input.' });
  const { classDay, classTime, capacity } = parsed.data;
  getDb().prepare(`
    INSERT INTO class_capacity (class_day, class_time, capacity)
    VALUES (?, ?, ?)
    ON CONFLICT(class_day, class_time) DO UPDATE SET capacity = excluded.capacity
  `).run(classDay, classTime, capacity);
  audit({ actor: req.user.email, action: 'class.capacity.set', meta: { classDay, classTime, capacity }, ip: req.ip });
  res.json({ ok: true });
});

router.get('/audit', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
  const rows = getDb().prepare('SELECT * FROM audit_log ORDER BY created_at DESC LIMIT ?').all(limit);
  res.json({ ok: true, audit: rows });
});

// ─── Coach payroll ────────────────────────────────────────────────────────
// Calculates pay per coach for a date range. Configure rates per coach via
// the COACH_RATES env var (JSON: {"sasha@gym.com": 35, "*": 30}) or pass in
// the request body to override per-call.
router.get('/payroll', (req, res) => {
  const from = String(req.query.from || '').slice(0, 10);
  const to   = String(req.query.to   || '').slice(0, 10);
  if (!from || !to) return res.status(422).json({ ok: false, error: 'from and to (YYYY-MM-DD) required.' });
  let rates = {};
  try { rates = JSON.parse(process.env.COACH_RATES || '{}'); } catch {}
  const defaultRate = parseFloat(rates['*'] || rates.default || '30');

  const rows = getDb().prepare(`
    SELECT a.checked_in_by AS coach_id, m.email AS coach_email, m.first_name, m.last_name,
           date(a.checked_in_at) AS d, COUNT(*) AS attended,
           COUNT(DISTINCT b.starts_at) AS classes_taught
    FROM attendance a
    LEFT JOIN bookings b ON b.id = a.booking_id
    LEFT JOIN members m ON m.id = a.checked_in_by
    WHERE date(a.checked_in_at) >= ? AND date(a.checked_in_at) <= ?
      AND a.status IN ('attended', 'late')
    GROUP BY a.checked_in_by, date(a.checked_in_at)
    ORDER BY d ASC, m.email ASC
  `).all(from, to);

  // Aggregate per coach
  const totals = {};
  for (const r of rows) {
    const key = r.coach_email || ('coach-' + r.coach_id);
    if (!totals[key]) totals[key] = {
      coach_id: r.coach_id, email: r.coach_email,
      name: ((r.first_name || '') + ' ' + (r.last_name || '')).trim() || r.coach_email,
      classes: 0, attendees: 0, days: 0,
      rate: rates[r.coach_email] || defaultRate,
      pay_pence: 0,
    };
    totals[key].classes += r.classes_taught;
    totals[key].attendees += r.attended;
    totals[key].days += 1;
    totals[key].pay_pence += Math.round((rates[r.coach_email] || defaultRate) * r.classes_taught * 100);
  }
  res.json({ ok: true, period: { from, to }, by_day: rows, totals: Object.values(totals) });
});

// ─── Waitlist promote (manual) ────────────────────────────────────────────
router.post('/bookings/:id/promote', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const b = getDb().prepare('SELECT * FROM bookings WHERE id = ?').get(id);
  if (!b) return res.status(404).json({ ok: false });
  if (b.status !== 'waitlist') return res.status(409).json({ ok: false, error: 'Booking is not on the waitlist.' });
  getDb().prepare(`UPDATE bookings SET status = 'confirmed', waitlist_position = NULL WHERE id = ?`).run(id);
  audit({ actor: req.user.email, action: 'booking.promoted', entity_id: id, ip: req.ip });
  res.json({ ok: true });
});

export default router;
