/* Class reminder worker. Wakes every 5 minutes, finds confirmed bookings
   starting in 50–70 minutes, and sends a reminder via email queue + web push.
   Idempotent — bookings.reminder_sent_at marks already-sent ones.
*/
import { getDb } from '../db.js';
import { pushToMember } from './push.js';
import { getBrand } from './brand.js';

let _worker = null;

async function tick() {
  const db = getDb();
  const due = db.prepare(`
    SELECT b.id, b.member_id, b.starts_at, b.program, b.class_time,
           m.email, m.first_name
    FROM bookings b
    JOIN members m ON m.id = b.member_id
    WHERE b.status = 'confirmed'
      AND b.reminder_sent_at IS NULL
      AND b.starts_at >= datetime('now', '+50 minutes')
      AND b.starts_at <= datetime('now', '+70 minutes')
  `).all();

  if (!due.length) return;

  const b = getBrand();
  const enqueue = db.prepare(`
    INSERT INTO email_queue (to_email, subject, text, send_after, source)
    VALUES (?, ?, ?, datetime('now'), ?)
  `);
  const mark = db.prepare(`UPDATE bookings SET reminder_sent_at = datetime('now') WHERE id = ?`);

  for (const r of due) {
    const when = new Date(r.starts_at);
    const localTime = when.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    enqueue.run(
      r.email,
      `${r.program} at ${localTime} — see you on the mat`,
      `Hi ${r.first_name || 'there'},\n\nQuick reminder: your ${r.program} class starts at ${localTime}.\nArrive 10 minutes early — kit ready, water bottle, comfortable mood.\n\nNeed to cancel? Sign in at ${b.url}/account.html\n\nSee you soon,\nForge Manchester`,
      'class-reminder:' + r.id,
    );
    pushToMember(r.member_id, {
      title: `${r.program} in ~1 hour`,
      body:  `Class at ${localTime}. Tap to see details.`,
      url:   '/account.html',
      tag:   'class-' + r.id,
    }).catch(() => {});
    mark.run(r.id);
  }
}

export function startReminderWorker() {
  if (_worker) return;
  setTimeout(tick, 8000); // first sweep shortly after boot
  _worker = setInterval(() => { tick().catch(() => {}); }, 5 * 60 * 1000);
}

export function stopReminderWorker() {
  if (_worker) { clearInterval(_worker); _worker = null; }
}
