import Stripe from 'stripe';

let _stripe = null;

export function getStripe() {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || key.startsWith('sk_test_replace')) {
    // Don't crash startup — surface a clear error when actually called.
    return null;
  }
  _stripe = new Stripe(key, { apiVersion: '2024-09-30.acacia' });
  return _stripe;
}

const PRICE_MAP = () => ({
  kids:      { monthly: process.env.STRIPE_PRICE_KIDS_MONTHLY,      annual: process.env.STRIPE_PRICE_KIDS_ANNUAL },
  unlimited: { monthly: process.env.STRIPE_PRICE_UNLIMITED_MONTHLY, annual: process.env.STRIPE_PRICE_UNLIMITED_ANNUAL },
  family:    { monthly: process.env.STRIPE_PRICE_FAMILY_MONTHLY,    annual: process.env.STRIPE_PRICE_FAMILY_ANNUAL },
});

export function priceIdFor(plan, period = 'monthly') {
  const map = PRICE_MAP();
  const tier = map[plan];
  if (!tier) return null;
  return tier[period] || tier.monthly;
}

export async function createCheckoutSession({ plan, period, customerEmail, successUrl, cancelUrl }) {
  const stripe = getStripe();
  if (!stripe) throw new Error('Stripe not configured (set STRIPE_SECRET_KEY)');
  const priceId = priceIdFor(plan, period);
  if (!priceId || priceId.startsWith('price_replace')) {
    throw new Error(`No Stripe price configured for plan="${plan}" period="${period}"`);
  }
  return stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    customer_email: customerEmail,
    allow_promotion_codes: true,
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { plan, period },
  });
}
