import { Router } from 'express';
import express from 'express';
import { checkoutSchema } from '../lib/validators.js';
import { createCheckoutSession, getStripe } from '../lib/stripe.js';
import { getDb, audit } from '../db.js';
import { requireMember } from '../middleware/auth.js';
import { onMemberPaid } from '../lib/referrals.js';
import { confirmPaidSlot } from './pt.js';
import { confirmPaidPass } from './passes.js';
import { dispatch as dispatchWebhook } from '../lib/webhooks.js';

const router = Router();

// Stripe Customer Portal
router.post('/portal', requireMember, async (req, res) => {
  const stripe = getStripe();
  if (!stripe) return res.status(500).json({ ok: false, error: 'Stripe not configured.' });
  const m = getDb().prepare('SELECT stripe_customer_id FROM members WHERE id = ?').get(req.user.id);
  if (!m?.stripe_customer_id) {
    return res.status(409).json({ ok: false, error: 'No active subscription found. Subscribe first via the Pricing page.' });
  }
  const base = (process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: m.stripe_customer_id,
      return_url: `${base}/account.html`,
    });
    audit({ actor: req.user.email, action: 'stripe.portal.opened', entity_id: req.user.id, ip: req.ip });
    res.json({ ok: true, url: session.url });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('billing portal error', err);
    res.status(500).json({ ok: false, error: err.message || 'Could not open billing portal.' });
  }
});

router.post('/session', async (req, res) => {
  const parsed = checkoutSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ ok: false, error: 'Invalid plan.' });
  const { plan, period, email } = parsed.data;
  const base = process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`;
  try {
    const session = await createCheckoutSession({
      plan, period,
      customerEmail: email || req.user?.email,
      successUrl: `${base}/account.html?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl:  `${base}/pricing.html?checkout=cancelled`,
    });
    audit({ actor: email || 'guest', action: 'checkout.created', entity: 'plan', meta: { plan, period }, ip: req.ip });
    res.json({ ok: true, url: session.url, id: session.id });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('checkout error', err);
    res.status(500).json({ ok: false, error: err.message || 'Could not start checkout.' });
  }
});

// ─── Idempotency: every event id is recorded once ──────────────────────────
function alreadyProcessed(eventId) {
  if (!eventId) return false;
  return !!getDb().prepare('SELECT id FROM processed_stripe_events WHERE id = ?').get(eventId);
}
function markProcessed(eventId, type) {
  try {
    getDb().prepare('INSERT OR IGNORE INTO processed_stripe_events (id, type) VALUES (?, ?)').run(eventId, type);
  } catch { /* unique-constraint race; another worker recorded it */ }
}

function recordInvoice(invoice) {
  if (!invoice) return;
  const email = invoice.customer_email;
  const member = email ? getDb().prepare('SELECT id FROM members WHERE email = ?').get(email) : null;
  getDb().prepare(`
    INSERT INTO member_invoices
      (member_id, stripe_invoice_id, stripe_charge_id, amount_pence, currency,
       status, hosted_invoice_url, pdf_url, paid_at, failed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(stripe_invoice_id) DO UPDATE SET
      status = excluded.status,
      paid_at = COALESCE(excluded.paid_at, member_invoices.paid_at),
      failed_at = COALESCE(excluded.failed_at, member_invoices.failed_at)
  `).run(
    member?.id || null,
    invoice.id,
    invoice.charge || null,
    invoice.amount_paid || invoice.amount_due || 0,
    invoice.currency || 'gbp',
    invoice.status === 'paid' ? 'paid' : (invoice.status === 'uncollectible' ? 'failed' : invoice.status),
    invoice.hosted_invoice_url || null,
    invoice.invoice_pdf || null,
    invoice.status === 'paid' ? new Date(((invoice.status_transitions?.paid_at || 0) * 1000) || Date.now()).toISOString() : null,
    invoice.status === 'uncollectible' ? new Date().toISOString() : null,
  );
}

export const stripeWebhookHandler = (req, res) => {
  const stripe = getStripe();
  if (!stripe) return res.status(500).send('Stripe not configured');
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Stripe signature verification failed', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Idempotency gate
  if (alreadyProcessed(event.id)) {
    return res.json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const s = event.data.object;
        const email = s.customer_email || s.customer_details?.email;
        const plan  = s.metadata?.plan;
        const kind  = s.metadata?.kind;

        if (plan && email) {
          getDb().prepare(`
            UPDATE members SET plan = COALESCE(?, plan), stripe_customer_id = COALESCE(?, stripe_customer_id),
                                subscription_status = 'active'
            WHERE email = ?
          `).run(plan, s.customer || null, email);
          audit({ actor: email, action: 'stripe.checkout.subscription', meta: { plan } });
          const m = getDb().prepare('SELECT id FROM members WHERE email = ?').get(email);
          if (m) try { onMemberPaid(m.id); } catch {}
          dispatchWebhook('subscription.created', { email, plan });
        }
        if (kind === 'pt')       confirmPaidSlot(s);
        if (kind === 'day_pass') confirmPaidPass(s);
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object;
        const status = sub.status;
        const periodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null;
        const planLabel = sub.items?.data?.[0]?.price?.lookup_key || sub.items?.data?.[0]?.price?.id;
        getDb().prepare(`
          UPDATE members SET subscription_status = ?, subscription_current_period_end = ?
          WHERE stripe_customer_id = ?
        `).run(status, periodEnd, sub.customer);
        audit({ action: 'stripe.subscription.updated', meta: { status, plan: planLabel, customer: sub.customer } });
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        getDb().prepare('UPDATE members SET plan = NULL, subscription_status = ? WHERE stripe_customer_id = ?')
          .run('canceled', sub.customer);
        audit({ action: 'stripe.subscription.deleted', meta: { customer: sub.customer } });
        dispatchWebhook('subscription.cancelled', { customer: sub.customer });
        break;
      }

      case 'invoice.payment_succeeded': {
        recordInvoice(event.data.object);
        break;
      }

      case 'invoice.payment_failed': {
        const inv = event.data.object;
        recordInvoice(inv);
        if (inv.customer_email) {
          getDb().prepare(`UPDATE members SET subscription_status = 'past_due' WHERE email = ?`).run(inv.customer_email);
        }
        audit({ actor: inv.customer_email, action: 'stripe.invoice.failed', meta: { invoice: inv.id } });
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object;
        getDb().prepare(`
          UPDATE member_invoices SET status = 'refunded', refunded_at = datetime('now')
          WHERE stripe_charge_id = ?
        `).run(charge.id);
        audit({ action: 'stripe.refund', meta: { charge: charge.id, amount: charge.amount_refunded } });
        break;
      }

      default: break;
    }

    markProcessed(event.id, event.type);
    res.json({ received: true });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('webhook handler error', err);
    // Don't markProcessed — let Stripe retry.
    res.status(500).send('Webhook handler failed');
  }
};

router.post('/webhook', stripeWebhookHandler);

export default router;
