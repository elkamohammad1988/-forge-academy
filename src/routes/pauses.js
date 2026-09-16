/* Membership pause / vacation hold. Members request, admin approves
   (or pause is auto-approved if rules permit). Stripe subscription is
   paused via Stripe API when configured.
*/
import { Router } from 'express';
import { z } from 'zod';
import { getDb, audit } from '../db.js';
import { requireMember, requireAdmin } from '../middleware/auth.js';
import { getStripe } from '../lib/stripe.js';

const router = Router();

const pauseSchema = z.object({
  starts_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  ends_on:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason:    z.string().max(500).optional().or(z.literal('')),
});

// Member: list my pauses + request a new one
router.get('/me', requireMember, (req, res) => {
  const rows = getDb().prepare(`
    SELECT * FROM member_pauses WHERE member_id = ? ORDER BY starts_on DESC
  `).all(req.user.id);
  res.json({ ok: true, pauses: rows });
});

router.post('/me', requireMember, async (req, res) => {
  const parsed = pauseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ ok: false, error: 'Invalid input.' });
  const d = parsed.data;

  if (new Date(d.starts_on) >= new Date(d.ends_on)) {
    return res.status(422).json({ ok: false, error: 'End date must be after start date.' });
  }

  // Auto-approve up to 3 months in length
  const days = Math.floor((new Date(d.ends_on) - new Date(d.starts_on)) / 86400000);
  const status = days <= 92 ? 'active' : 'requested';

  const r = getDb().prepare(`
    INSERT INTO member_pauses (member_id, starts_on, ends_on, reason, status)
    VALUES (?, ?, ?, ?, ?)
  `).run(req.user.id, d.starts_on, d.ends_on, d.reason || null, status);

  // Pause Stripe subscription if active
  const member = getDb().prepare('SELECT stripe_customer_id FROM members WHERE id = ?').get(req.user.id);
  const stripe = getStripe();
  if (status === 'active' && stripe && member?.stripe_customer_id) {
    try {
      const subs = await stripe.subscriptions.list({ customer: member.stripe_customer_id, status: 'active', limit: 5 });
      for (const s of subs.data) {
        // eslint-disable-next-line no-await-in-loop
        await stripe.subscriptions.update(s.id, {
          pause_collection: { behavior: 'mark_uncollectible', resumes_at: Math.floor(new Date(d.ends_on).getTime() / 1000) },
        });
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('stripe pause failed', err.message);
    }
  }

  audit({ actor: req.user.email, action: 'pause.created', entity_id: r.lastInsertRowid, meta: { days, status }, ip: req.ip });
  res.json({ ok: true, id: r.lastInsertRowid, status });
});

router.delete('/me/:id', requireMember, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const pause = getDb().prepare('SELECT * FROM member_pauses WHERE id = ? AND member_id = ?').get(id, req.user.id);
  if (!pause) return res.status(404).json({ ok: false });
  getDb().prepare(`UPDATE member_pauses SET status = 'cancelled' WHERE id = ?`).run(id);

  // Resume Stripe subscription
  const member = getDb().prepare('SELECT stripe_customer_id FROM members WHERE id = ?').get(req.user.id);
  const stripe = getStripe();
  if (stripe && member?.stripe_customer_id) {
    try {
      const subs = await stripe.subscriptions.list({ customer: member.stripe_customer_id, limit: 5 });
      for (const s of subs.data) {
        if (s.pause_collection) {
          // eslint-disable-next-line no-await-in-loop
          await stripe.subscriptions.update(s.id, { pause_collection: '' });
        }
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('stripe resume failed', err.message);
    }
  }
  audit({ actor: req.user.email, action: 'pause.cancelled', entity_id: id, ip: req.ip });
  res.json({ ok: true });
});

// Admin: list & approve pending pauses
router.get('/', requireAdmin, (_req, res) => {
  const rows = getDb().prepare(`
    SELECT p.*, m.email, m.first_name, m.last_name
    FROM member_pauses p JOIN members m ON m.id = p.member_id
    ORDER BY p.created_at DESC LIMIT 200
  `).all();
  res.json({ ok: true, pauses: rows });
});

router.patch('/:id', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const status = String(req.body?.status || '');
  if (!['active', 'cancelled', 'ended', 'requested'].includes(status)) return res.status(422).json({ ok: false });
  getDb().prepare('UPDATE member_pauses SET status = ? WHERE id = ?').run(status, id);
  audit({ actor: req.user.email, action: 'pause.status', entity_id: id, meta: { status }, ip: req.ip });
  res.json({ ok: true });
});

export default router;
