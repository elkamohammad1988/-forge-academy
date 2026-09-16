-- ─── Stripe webhook idempotency ─────────────────────────────────────────
-- Stripe guarantees at-least-once delivery. Without this, retried
-- checkout.session.completed events would re-grant plans, re-credit
-- referrers, re-confirm PT slots, etc. Standard pattern: record every
-- processed event ID; the second arrival returns 200 immediately.
CREATE TABLE IF NOT EXISTS processed_stripe_events (
  id            TEXT PRIMARY KEY,           -- Stripe event id (evt_…)
  type          TEXT NOT NULL,
  processed_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Subscription lifecycle: track the live status from Stripe so the
-- "your plan is past_due" / "paused" badge in the member portal can
-- be honest. Updated by customer.subscription.updated.
ALTER TABLE members ADD COLUMN subscription_status TEXT;
ALTER TABLE members ADD COLUMN subscription_current_period_end TEXT;

-- Invoice audit trail (renewals, failures, refunds)
CREATE TABLE IF NOT EXISTS member_invoices (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id           INTEGER REFERENCES members(id) ON DELETE SET NULL,
  stripe_invoice_id   TEXT UNIQUE,
  stripe_charge_id    TEXT,
  amount_pence        INTEGER NOT NULL,
  currency            TEXT NOT NULL DEFAULT 'gbp',
  status              TEXT NOT NULL,        -- 'paid' | 'failed' | 'refunded' | 'open'
  hosted_invoice_url  TEXT,
  pdf_url             TEXT,
  paid_at             TEXT,
  failed_at           TEXT,
  refunded_at         TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_invoices_member ON member_invoices(member_id);

-- Hot-path index that was missing
CREATE INDEX IF NOT EXISTS idx_audit_created   ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_email_q_sent    ON email_queue(sent_at);
CREATE INDEX IF NOT EXISTS idx_webhook_deliv_created ON webhook_deliveries(created_at);
CREATE INDEX IF NOT EXISTS idx_bookings_member_starts ON bookings(member_id, starts_at);
