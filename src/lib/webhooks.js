/* Generic outbound webhook dispatcher. Replaces (and supersedes) the
   single-purpose notify.js path. Anyone with admin access can subscribe a
   URL to one or more events; we POST a signed JSON payload on each event
   and log the result to webhook_deliveries.
*/
import { createHmac } from 'node:crypto';
import { getDb } from '../db.js';

export const EVENTS = [
  'lead.created',
  'contact.created',
  'newsletter.subscribed',
  'booking.confirmed',
  'booking.waitlisted',
  'booking.cancelled',
  'attendance.marked',
  'member.registered',
  'subscription.created',
  'subscription.cancelled',
];

function sign(secret, body) {
  return 'sha256=' + createHmac('sha256', secret).update(body).digest('hex');
}

export function dispatch(event, payload) {
  const db = getDb();
  const subs = db.prepare(`
    SELECT * FROM webhook_subscriptions WHERE active = 1
  `).all().filter((s) => {
    const ev = (s.events || '').split(',').map((x) => x.trim());
    return ev.includes('*') || ev.includes(event);
  });
  if (!subs.length) return;

  const body = JSON.stringify({ event, ts: new Date().toISOString(), payload });
  for (const sub of subs) {
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent':   'Forge-Webhook/1.0',
      'X-Forge-Event': event,
    };
    if (sub.secret) headers['X-Forge-Signature'] = sign(sub.secret, body);

    fetch(sub.url, { method: 'POST', headers, body }).then(async (res) => {
      const text = await res.text().catch(() => '');
      const ok = res.status >= 200 && res.status < 300;
      db.prepare(`
        INSERT INTO webhook_deliveries (subscription_id, event, payload, status, response_body, attempts, next_attempt_at)
        VALUES (?, ?, ?, ?, ?, 1, ?)
      `).run(sub.id, event, body, res.status, text.slice(0, 2000), ok ? null : nextRetryAt(1));
      db.prepare(`UPDATE webhook_subscriptions SET last_status = ?, last_at = datetime('now') WHERE id = ?`).run(res.status, sub.id);
    }).catch((err) => {
      db.prepare(`
        INSERT INTO webhook_deliveries (subscription_id, event, payload, status, response_body, attempts, next_attempt_at)
        VALUES (?, ?, ?, NULL, ?, 1, ?)
      `).run(sub.id, event, body, String(err.message).slice(0, 2000), nextRetryAt(1));
      db.prepare(`UPDATE webhook_subscriptions SET last_status = 0, last_at = datetime('now') WHERE id = ?`).run(sub.id);
    });
  }
}

// Exponential backoff: 1m, 5m, 30m, 2h, 6h, then dead-letter at 6 attempts.
function nextRetryAt(attempts) {
  const minutes = [1, 5, 30, 120, 360];
  const wait = minutes[Math.min(attempts - 1, minutes.length - 1)];
  if (attempts >= 6) return null; // dead-letter
  return `datetime('now', '+${wait} minutes')`;
}

let _retryWorker = null;

export function startWebhookRetryWorker() {
  if (_retryWorker) return;
  const tick = () => {
    try {
      const db = getDb();
      const due = db.prepare(`
        SELECT d.*, s.url, s.secret, s.events
        FROM webhook_deliveries d
        JOIN webhook_subscriptions s ON s.id = d.subscription_id
        WHERE d.next_attempt_at IS NOT NULL
          AND d.next_attempt_at <= datetime('now')
          AND d.attempts < 6
          AND s.active = 1
        LIMIT 25
      `).all();

      for (const row of due) {
        const headers = {
          'Content-Type': 'application/json',
          'User-Agent':   'Forge-Webhook/1.0',
          'X-Forge-Event': row.event,
          'X-Forge-Retry': String(row.attempts + 1),
        };
        if (row.secret) headers['X-Forge-Signature'] = 'sha256=' + createHmac('sha256', row.secret).update(row.payload).digest('hex');

        fetch(row.url, { method: 'POST', headers, body: row.payload }).then(async (res) => {
          const text = await res.text().catch(() => '');
          const ok = res.status >= 200 && res.status < 300;
          const attempts = row.attempts + 1;
          db.prepare(`
            UPDATE webhook_deliveries
            SET status = ?, response_body = ?, attempts = ?, next_attempt_at = ?
            WHERE id = ?
          `).run(res.status, text.slice(0, 2000), attempts, ok ? null : (attempts >= 6 ? null : nextAttemptIso(attempts)), row.id);
        }).catch((err) => {
          const attempts = row.attempts + 1;
          db.prepare(`
            UPDATE webhook_deliveries
            SET response_body = ?, attempts = ?, next_attempt_at = ?
            WHERE id = ?
          `).run(String(err.message).slice(0, 2000), attempts, attempts >= 6 ? null : nextAttemptIso(attempts), row.id);
        });
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('webhook retry worker error', e.message);
    }
  };
  setTimeout(tick, 12000);
  _retryWorker = setInterval(tick, 30 * 1000);
}

function nextAttemptIso(attempts) {
  const minutes = [1, 5, 30, 120, 360];
  const wait = minutes[Math.min(attempts - 1, minutes.length - 1)];
  return new Date(Date.now() + wait * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19);
}

export function stopWebhookRetryWorker() {
  if (_retryWorker) { clearInterval(_retryWorker); _retryWorker = null; }
}
