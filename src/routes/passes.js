/* Day-pass / drop-in payments. Single Stripe one-off payment grants a
   redeemable code that can be used for one class booking.
*/
import { Router } from 'express';
import { z } from 'zod';
import { randomBytes } from 'node:crypto';
import { getDb, audit } from '../db.js';
import { getStripe } from '../lib/stripe.js';
import { sendMail } from '../lib/email.js';

const router = Router();

const checkoutSchema = z.object({ email: z.string().email() });

// Anyone (logged in or not) can buy a pass
router.post('/checkout', async (req, res) => {
  const parsed = checkoutSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ ok: false, error: 'Email required.' });
  const stripe = getStripe();
  const base = (process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
  const pricePence = parseInt(process.env.DAY_PASS_PRICE_PENCE || '1800', 10);

  if (!stripe) return res.status(503).json({ ok: false, error: 'Stripe not configured.' });
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency: 'gbp',
        unit_amount: pricePence,
        product_data: { name: 'Forge Day Pass — single class' },
      },
      quantity: 1,
    }],
    customer_email: parsed.data.email,
    success_url: `${base}/booking.html?pass=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:  `${base}/pricing.html?pass=cancelled`,
    metadata: { kind: 'day_pass', email: parsed.data.email },
  });
  res.json({ ok: true, url: session.url });
});

// Webhook calls this after checkout completes (kind=='day_pass')
export function confirmPaidPass(stripeSession) {
  const code  = randomBytes(6).toString('base64url').toUpperCase();
  const email = stripeSession.metadata?.email || stripeSession.customer_details?.email;
  if (!email) return;
  const member = getDb().prepare('SELECT id FROM members WHERE email = ?').get(email);
  getDb().prepare(`
    INSERT INTO day_passes (member_id, email, code, paid_at, stripe_session_id)
    VALUES (?, ?, ?, datetime('now'), ?)
  `).run(member?.id || null, email, code, stripeSession.id);
  audit({ actor: email, action: 'pass.purchased' });
  sendMail({
    to: email,
    subject: 'Your Forge day pass — code inside',
    text: `Thanks for grabbing a day pass.\n\nYour redeemable code: ${code}\n\nUse it once on any class — give the code to reception when you arrive.\n\nSee you on the mats.\n\n— Forge Manchester`,
  }).catch(() => {});
}

// Coach/admin: redeem a pass against a booking (or just mark used)
const redeemSchema = z.object({
  code:        z.string().min(4).max(40),
  booking_id:  z.coerce.number().int().optional(),
});
router.post('/redeem', (req, res) => {
  if (!req.user || !['coach', 'admin'].includes(req.user.role)) return res.status(403).json({ ok: false });
  const parsed = redeemSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ ok: false });
  const code = parsed.data.code.toUpperCase();
  const pass = getDb().prepare('SELECT * FROM day_passes WHERE code = ?').get(code);
  if (!pass) return res.status(404).json({ ok: false, error: 'Code not found.' });
  if (pass.redeemed_at) return res.status(409).json({ ok: false, error: 'Already used on ' + pass.redeemed_at });
  getDb().prepare(`UPDATE day_passes SET redeemed_at = datetime('now'), redeemed_for_booking = ? WHERE id = ?`)
    .run(parsed.data.booking_id || null, pass.id);
  audit({ actor: req.user.email, action: 'pass.redeemed', entity_id: pass.id, ip: req.ip });
  res.json({ ok: true, email: pass.email });
});

router.get('/list', (req, res) => {
  if (!req.user || req.user.role !== 'admin') return res.status(403).json({ ok: false });
  const rows = getDb().prepare(`
    SELECT * FROM day_passes ORDER BY created_at DESC LIMIT 200
  `).all();
  res.json({ ok: true, passes: rows });
});

export default router;
