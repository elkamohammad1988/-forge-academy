/* Periodic retention sweep so SQLite doesn't grow forever.
 *
 *  audit_log              — keep last RETENTION_AUDIT_DAYS (default 365)
 *  email_queue (sent)     — keep last RETENTION_EMAIL_DAYS (default 30)
 *  webhook_deliveries     — keep last RETENTION_WEBHOOK_DAYS (default 90)
 *  processed_stripe_events — keep last 90 days (idempotency window)
 *
 * Wakes every 6h. Each sweep is a single transaction, runs in milliseconds
 * even on millions of rows because all the columns are indexed.
 */
import { getDb } from '../db.js';

const HOURS = 6;
let _worker = null;

function days(name, fb) { return parseInt(process.env[name] || String(fb), 10); }

function sweep() {
  const db = getDb();
  const stats = {};
  try {
    db.transaction(() => {
      stats.audit = db.prepare(
        `DELETE FROM audit_log WHERE created_at < date('now', ?)`
      ).run(`-${days('RETENTION_AUDIT_DAYS', 365)} days`).changes;

      stats.email = db.prepare(
        `DELETE FROM email_queue WHERE sent_at IS NOT NULL AND sent_at < date('now', ?)`
      ).run(`-${days('RETENTION_EMAIL_DAYS', 30)} days`).changes;

      stats.webhooks = db.prepare(
        `DELETE FROM webhook_deliveries WHERE created_at < date('now', ?)`
      ).run(`-${days('RETENTION_WEBHOOK_DAYS', 90)} days`).changes;

      stats.stripe = db.prepare(
        `DELETE FROM processed_stripe_events WHERE processed_at < date('now', '-90 days')`
      ).run().changes;
    })();
    if (process.env.NODE_ENV !== 'test' && (stats.audit || stats.email || stats.webhooks || stats.stripe)) {
      // eslint-disable-next-line no-console
      console.log(`✓ retention sweep: audit=${stats.audit} email=${stats.email} webhooks=${stats.webhooks} stripe=${stats.stripe}`);
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('retention sweep error', e.message);
  }
}

export function startRetentionWorker() {
  if (_worker) return;
  setTimeout(sweep, 60_000);                      // first sweep ~1 min after boot
  _worker = setInterval(sweep, HOURS * 3600 * 1000);
}
export function stopRetentionWorker() {
  if (_worker) { clearInterval(_worker); _worker = null; }
}
