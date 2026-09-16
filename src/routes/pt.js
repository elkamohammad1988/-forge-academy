/* Personal Training: coaches publish 1-on-1 availability, members book and
   pay via Stripe. Coaches see their PT bookings in the coach panel.
*/
import { Router } from 'express';
import { z } from 'zod';
import { getDb, audit } from '../db.js';
import { requireMember } from '../middleware/auth.js';
import { requireSignedWaiver } from '../middleware/waiver.js';
import { getStripe } from '../lib/stripe.js';
import { sendMail } from '../lib/email.js';
import { dispatch as dispatchWebhook } from '../lib/webhooks.js';

const router = Router();

// ─── Public listing of upcoming open slots ─────────────────────────────────
router.get('/slots', (_req, res) => {
  const rows = getDb().prepare(`
    SELECT s.id, s.starts_at, s.duration, s.price_pence, s.notes,
           m.id AS coach_id, m.first_name AS coach_first, m.last_name AS coach_last
    FROM pt_slots s
    JOIN members m ON m.id = s.coach_id
    WHERE s.status = 'open' AND s.starts_at > datetime('now')
    ORDER BY s.starts_at ASC LIMIT 100
  `).all();
  res.json({
    ok: true,
    slots: rows.map((r) => ({
      id: r.id, starts_at: r.starts_at, duration: r.duration,
      price_pence: r.price_pence, notes: r.notes,
      coach: `${r.coach_first || ''} ${r.coach_last || ''}`.trim(),
    })),
  });
});

// ─── Coach: my PT slots (includes booked + completed) ─────────────────────
router.get('/me/slots', requireMember, (req, res) => {
  if (!['coach', 'admin'].includes(req.user.role)) return res.status(403).json({ ok: false });
  const rows = getDb().prepare(`
    SELECT s.*, m.email AS member_email, m.first_name AS member_first
    FROM pt_slots s
    LEFT JOIN members m ON m.id = s.member_id
    WHERE s.coach_id = ?
    ORDER BY s.starts_at ASC
  `).all(req.user.id);
  res.json({ ok: true, slots: rows });
});

// ─── Coach: publish a new availability slot ────────────────────────────────
const slotSchema = z.object({
  starts_at:   z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/),
  duration:    z.coerce.number().int().min(15).max(240).default(60),
  price_pence: z.coerce.number().int().min(0).max(100_000).default(5000),
  notes:       z.string().max(300).optional().or(z.literal('')),
});
router.post('/me/slots', requireMember, (req, res) => {
  if (!['coach', 'admin'].includes(req.user.role)) return res.status(403).json({ ok: false });
  const parsed = slotSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ ok: false, error: 'Invalid input.' });
  const d = parsed.data;
  const r = getDb().prepare(`
    INSERT INTO pt_slots (coach_id, starts_at, duration, price_pence, notes)
    VALUES (?, ?, ?, ?, ?)
  `).run(req.user.id, d.starts_at, d.duration, d.price_pence, d.notes || null);
  audit({ actor: req.user.email, action: 'pt.slot.created', entity_id: r.lastInsertRowid, ip: req.ip });
  res.json({ ok: true, id: r.lastInsertRowid });
});

router.delete('/me/slots/:id', requireMember, (req, res) => {
  if (!['coach', 'admin'].includes(req.user.role)) return res.status(403).json({ ok: false });
  const id = parseInt(req.params.id, 10);
  const slot = getDb().prepare('SELECT * FROM pt_slots WHERE id = ? AND coach_id = ?').get(id, req.user.id);
  if (!slot) return res.status(404).json({ ok: false });
  if (slot.status === 'booked') return res.status(409).json({ ok: false, error: 'Slot is already booked. Refund the member first.' });
  getDb().prepare(`UPDATE pt_slots SET status = 'cancelled' WHERE id = ?`).run(id);
  audit({ actor: req.user.email, action: 'pt.slot.cancelled', entity_id: id, ip: req.ip });
  res.json({ ok: true });
});

// ─── Member: start checkout for a slot ─────────────────────────────────────
router.post('/book/:id', requireMember, requireSignedWaiver, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const slot = getDb().prepare(`SELECT * FROM pt_slots WHERE id = ?`).get(id);
  if (!slot || slot.status !== 'open') return res.status(404).json({ ok: false, error: 'Slot unavailable.' });

  const stripe = getStripe();
  const base = (process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');

  if (stripe && slot.price_pence > 0) {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'gbp',
          unit_amount: slot.price_pence,
          product_data: { name: `Forge PT — 1-on-1 (${slot.duration} min)`, description: new Date(slot.starts_at).toLocaleString('en-GB') },
        },
        quantity: 1,
      }],
      customer_email: req.user.email,
      success_url: `${base}/account.html?pt=paid&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${base}/schedule.html?pt=cancelled`,
      metadata: { kind: 'pt', slot_id: String(slot.id), member_id: String(req.user.id) },
    });
    // Optimistically reserve the slot for 15 minutes via stripe_session_id
    getDb().prepare(`UPDATE pt_slots SET stripe_session_id = ?, member_id = ? WHERE id = ?`).run(session.id, req.user.id, slot.id);
    return res.json({ ok: true, url: session.url });
  }

  // Free slot or Stripe not configured — book directly
  getDb().prepare(`UPDATE pt_slots SET status = 'booked', member_id = ?, paid_at = datetime('now') WHERE id = ?`).run(req.user.id, slot.id);
  audit({ actor: req.user.email, action: 'pt.booked.free', entity_id: slot.id, ip: req.ip });
  dispatchWebhook('pt.booked', { slot_id: slot.id, member_email: req.user.email });
  res.json({ ok: true, free: true });
});

// Called by Stripe webhook (in checkout.js) for the 'pt' kind
export function confirmPaidSlot(stripeSession) {
  const db = getDb();
  const slotId = parseInt(stripeSession.metadata?.slot_id || '', 10);
  if (!slotId) return;
  const slot = db.prepare(`SELECT * FROM pt_slots WHERE id = ?`).get(slotId);
  if (!slot) return;
  db.prepare(`UPDATE pt_slots SET status = 'booked', paid_at = datetime('now') WHERE id = ?`).run(slotId);
  audit({ actor: stripeSession.customer_email, action: 'pt.booked.paid', entity_id: slotId });
  dispatchWebhook('pt.booked', { slot_id: slotId, member_email: stripeSession.customer_email });
  // Email confirmation
  if (stripeSession.customer_email) {
    sendMail({
      to: stripeSession.customer_email,
      subject: 'Your 1-on-1 is confirmed',
      text: `Your personal training session is confirmed for ${new Date(slot.starts_at).toLocaleString('en-GB')}.\nDuration: ${slot.duration} minutes.\nSee you on the mats.`,
    }).catch(() => {});
  }
}

// ─── Member: my upcoming PT bookings ──────────────────────────────────────
router.get('/me', requireMember, (req, res) => {
  const rows = getDb().prepare(`
    SELECT s.id, s.starts_at, s.duration, s.price_pence, s.status, s.notes,
           m.first_name AS coach_first, m.last_name AS coach_last
    FROM pt_slots s
    JOIN members m ON m.id = s.coach_id
    WHERE s.member_id = ? AND s.starts_at > datetime('now', '-2 hours')
    ORDER BY s.starts_at ASC
  `).all(req.user.id);
  res.json({ ok: true, sessions: rows });
});

export default router;
