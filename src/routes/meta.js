import { Router } from 'express';
import { getDb } from '../db.js';
import { getBrand, getFeatures } from '../lib/brand.js';
import { getTransporter } from '../lib/email.js';
import { getStripe } from '../lib/stripe.js';

const router = Router();
const startedAt = Date.now();

// ─── Public brand + feature flag exposure ──────────────────────────────────
router.get('/brand', (_req, res) => {
  const b = getBrand();
  // Expose only the public-safe fields
  res.json({
    ok: true,
    brand: {
      name: b.name, shortName: b.shortName, tagline: b.tagline,
      city: b.city, established: b.established,
      url: b.url, email: b.email,
      phoneDisplay: b.phoneDisplay, phoneTel: b.phoneTel, whatsapp: b.whatsapp,
      address: b.address, hours: b.hours, social: b.social, stats: b.stats,
    },
    features: getFeatures(),
  });
});

// ─── Deep health check — DB + email + Stripe + filesystem ──────────────────
router.get('/health/deep', async (_req, res) => {
  const checks = { ts: new Date().toISOString() };
  let allOk = true;

  try {
    const r = getDb().prepare('SELECT 1 AS ok').get();
    checks.db = r?.ok === 1 ? { ok: true } : { ok: false, error: 'unexpected response' };
  } catch (e) { checks.db = { ok: false, error: e.message }; allOk = false; }

  try {
    const t = getTransporter();
    if (process.env.SMTP_HOST) {
      await t.verify();
      checks.email = { ok: true, mode: 'smtp' };
    } else {
      checks.email = { ok: true, mode: 'stream (dev/console only)' };
    }
  } catch (e) { checks.email = { ok: false, error: e.message }; allOk = false; }

  if (process.env.STRIPE_SECRET_KEY && !process.env.STRIPE_SECRET_KEY.startsWith('sk_test_replace')) {
    try {
      const s = getStripe();
      await s.balance.retrieve();
      checks.stripe = { ok: true, mode: process.env.STRIPE_SECRET_KEY.startsWith('sk_test') ? 'test' : 'live' };
    } catch (e) { checks.stripe = { ok: false, error: e.message }; allOk = false; }
  } else {
    checks.stripe = { ok: true, mode: 'disabled' };
  }

  checks.uptime_seconds = Math.round((Date.now() - startedAt) / 1000);
  checks.memory_rss_mb  = Math.round(process.memoryUsage().rss / 1024 / 1024);
  checks.node           = process.version;

  res.status(allOk ? 200 : 503).json({ ok: allOk, checks });
});

// ─── Prometheus-style metrics (text/plain) ────────────────────────────────
router.get('/metrics', (_req, res) => {
  const db = getDb();
  const counts = {
    leads_total:    db.prepare('SELECT COUNT(*) AS c FROM leads').get().c,
    contacts_total: db.prepare('SELECT COUNT(*) AS c FROM contacts').get().c,
    members_total:  db.prepare('SELECT COUNT(*) AS c FROM members').get().c,
    bookings_total: db.prepare(`SELECT COUNT(*) AS c FROM bookings WHERE status = 'confirmed'`).get().c,
    newsletter_subscribers: db.prepare('SELECT COUNT(*) AS c FROM newsletter WHERE unsubscribed_at IS NULL').get().c,
  };
  const mem = process.memoryUsage();
  const uptime = (Date.now() - startedAt) / 1000;

  const lines = [
    '# HELP forge_uptime_seconds Process uptime',
    '# TYPE forge_uptime_seconds gauge',
    `forge_uptime_seconds ${uptime.toFixed(0)}`,
    '# HELP forge_memory_rss_bytes Resident set size',
    '# TYPE forge_memory_rss_bytes gauge',
    `forge_memory_rss_bytes ${mem.rss}`,
    '# HELP forge_memory_heap_used_bytes Heap used',
    '# TYPE forge_memory_heap_used_bytes gauge',
    `forge_memory_heap_used_bytes ${mem.heapUsed}`,
    '# HELP forge_db_rows Row counts per table',
    '# TYPE forge_db_rows gauge',
    `forge_db_rows{table="leads"} ${counts.leads_total}`,
    `forge_db_rows{table="contacts"} ${counts.contacts_total}`,
    `forge_db_rows{table="members"} ${counts.members_total}`,
    `forge_db_rows{table="bookings"} ${counts.bookings_total}`,
    `forge_db_rows{table="newsletter"} ${counts.newsletter_subscribers}`,
  ].join('\n');
  res.type('text/plain; version=0.0.4').send(lines + '\n');
});

// ─── OpenAPI 3.1 spec ─────────────────────────────────────────────────────
const OPENAPI = {
  openapi: '3.1.0',
  info: {
    title: 'Forge Academy API',
    version: '1.0.0',
    description: 'Public + member + admin endpoints powering forgemartialarts.co.uk',
    contact: { email: 'hello@forgemartialarts.co.uk', url: 'https://forgemartialarts.co.uk/' },
    license: { name: 'Proprietary' },
  },
  servers: [
    { url: 'https://forgemartialarts.co.uk/api', description: 'Production' },
    { url: 'http://localhost:3000/api', description: 'Local dev' },
  ],
  components: {
    securitySchemes: {
      cookieAuth: { type: 'apiKey', in: 'cookie', name: 'forge_session' },
    },
    schemas: {
      Lead: {
        type: 'object',
        required: ['firstName', 'email'],
        properties: {
          firstName: { type: 'string', maxLength: 80 },
          lastName:  { type: 'string', maxLength: 80 },
          email:     { type: 'string', format: 'email' },
          phone:     { type: 'string', maxLength: 40 },
          program:   { type: 'string', maxLength: 80 },
          consent:   { type: 'boolean' },
        },
      },
      Member: {
        type: 'object',
        properties: {
          id: { type: 'integer' }, email: { type: 'string', format: 'email' },
          firstName: { type: 'string' }, lastName: { type: 'string' },
          plan: { type: 'string', nullable: true }, role: { type: 'string', enum: ['member','admin'] },
          emailVerified: { type: 'boolean' },
        },
      },
      Error: { type: 'object', properties: { ok: { const: false }, error: { type: 'string' } } },
    },
  },
  paths: {
    '/health': { get: { summary: 'Liveness probe', responses: { 200: { description: 'OK' } } } },
    '/schedule': { get: { summary: 'Weekly timetable with capacity & spots_left', responses: { 200: { description: 'OK' } } } },
    '/schedule/next': { get: { summary: 'Next class about to start', responses: { 200: { description: 'OK' } } } },
    '/leads': {
      post: {
        summary: 'Submit a trial booking lead',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/Lead' } } } },
        responses: { 200: { description: 'Created' }, 422: { description: 'Validation' } },
      },
    },
    '/contact': { post: { summary: 'Submit contact form' } },
    '/newsletter': { post: { summary: 'Subscribe' } },
    '/auth/register': { post: { summary: 'Create member account' } },
    '/auth/login':    { post: { summary: 'Sign in' } },
    '/auth/logout':   { post: { summary: 'Sign out' } },
    '/auth/me':       { get:  { summary: 'Current member', security: [{ cookieAuth: [] }] } },
    '/auth/forgot':   { post: { summary: 'Request password reset email' } },
    '/auth/reset':    { post: { summary: 'Confirm password reset with token' } },
    '/auth/verify-email':        { post: { summary: 'Confirm email with token' } },
    '/auth/verify-email/resend': { post: { summary: 'Resend verification', security: [{ cookieAuth: [] }] } },
    '/auth/profile':         { patch: { summary: 'Update profile', security: [{ cookieAuth: [] }] } },
    '/auth/change-password': { post:  { summary: 'Change password', security: [{ cookieAuth: [] }] } },
    '/bookings': {
      get:  { summary: 'My upcoming bookings', security: [{ cookieAuth: [] }] },
      post: { summary: 'Book a class (or join waitlist if full)', security: [{ cookieAuth: [] }] },
    },
    '/bookings/{id}': {
      delete: { summary: 'Cancel a booking', security: [{ cookieAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }] },
    },
    '/checkout/session': { post: { summary: 'Create Stripe Checkout Session for a plan' } },
    '/checkout/portal':  { post: { summary: 'Open Stripe Billing Portal', security: [{ cookieAuth: [] }] } },
    '/checkout/webhook': { post: { summary: 'Stripe webhook (signed)' } },
    '/admin/stats':     { get:  { summary: 'Dashboard stats', security: [{ cookieAuth: [] }] } },
    '/admin/leads':     { get:  { summary: 'List leads',      security: [{ cookieAuth: [] }] } },
    '/admin/leads.csv': { get:  { summary: 'CSV export',      security: [{ cookieAuth: [] }] } },
    '/admin/leads/{id}':       { get:   { summary: 'Lead detail with notes', security: [{ cookieAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }] }, patch: { summary: 'Update lead status', security: [{ cookieAuth: [] }] } },
    '/admin/leads/{id}/notes': { post: { summary: 'Add a note to a lead', security: [{ cookieAuth: [] }] } },
    '/admin/contacts':  { get: { summary: 'List contact messages', security: [{ cookieAuth: [] }] } },
    '/admin/members':   { get: { summary: 'List members', security: [{ cookieAuth: [] }] } },
    '/admin/members/{id}': { patch: { summary: 'Change role', security: [{ cookieAuth: [] }] } },
    '/admin/newsletter/broadcast': { post: { summary: 'Send a newsletter blast', security: [{ cookieAuth: [] }] } },
    '/admin/capacity':  { put: { summary: 'Override class capacity', security: [{ cookieAuth: [] }] } },
    '/admin/audit':     { get: { summary: 'Last 100 audit-log entries', security: [{ cookieAuth: [] }] } },
    '/metrics':         { get: { summary: 'Prometheus metrics' } },
    '/openapi.json':    { get: { summary: 'This document' } },
    '/pt/slots':        { get: { summary: 'Open PT availability slots' } },
    '/pt/me':           { get: { summary: 'My booked PT sessions', security: [{ cookieAuth: [] }] } },
    '/pt/me/slots':     { get: { summary: 'Coach: my published slots', security: [{ cookieAuth: [] }] }, post: { summary: 'Coach: publish a slot', security: [{ cookieAuth: [] }] } },
    '/pt/book/{id}':    { post: { summary: 'Member: book a PT slot (Stripe checkout)', security: [{ cookieAuth: [] }] } },
    '/gradings/me':     { get: { summary: 'My belt history', security: [{ cookieAuth: [] }] } },
    '/gradings/grant':  { post: { summary: 'Admin: award a grading', security: [{ cookieAuth: [] }] } },
    '/pauses/me':       { get: { summary: 'My membership pauses', security: [{ cookieAuth: [] }] }, post: { summary: 'Request a pause', security: [{ cookieAuth: [] }] } },
    '/passes/checkout': { post: { summary: 'Buy a single-class day pass' } },
    '/passes/redeem':   { post: { summary: 'Coach: redeem a pass code', security: [{ cookieAuth: [] }] } },
    '/admin/payroll':   { get: { summary: 'Coach payroll for a date range', security: [{ cookieAuth: [] }] } },
    '/admin/bookings/{id}/promote': { post: { summary: 'Promote a waitlisted booking to confirmed', security: [{ cookieAuth: [] }] } },
  },
};
router.get('/openapi.json', (_req, res) => res.json(OPENAPI));

export default router;
