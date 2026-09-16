/* Web push (VAPID-signed) — class reminders, gym announcements.
   Falls back to a no-op when VAPID env vars aren't configured.
*/
import webpush from 'web-push';
import { getDb } from '../db.js';

let _configured = null;

export function isConfigured() {
  if (_configured !== null) return _configured;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const prv = process.env.VAPID_PRIVATE_KEY;
  const sub = process.env.VAPID_SUBJECT || 'mailto:hello@example.com';
  if (pub && prv) {
    try {
      webpush.setVapidDetails(sub, pub, prv);
      _configured = true;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('VAPID config failed', e.message);
      _configured = false;
    }
  } else {
    _configured = false;
  }
  return _configured;
}

export function publicKey() {
  return process.env.VAPID_PUBLIC_KEY || '';
}

export async function pushToMember(memberId, payload) {
  if (!isConfigured()) return { sent: 0, failed: 0 };
  const subs = getDb().prepare('SELECT * FROM push_subscriptions WHERE member_id = ?').all(memberId);
  const body = JSON.stringify(payload);
  let sent = 0, failed = 0;
  for (const sub of subs) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await webpush.sendNotification({
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      }, body);
      sent++;
    } catch (err) {
      failed++;
      // 410 / 404 → subscription is dead, remove it
      if (err.statusCode === 410 || err.statusCode === 404) {
        getDb().prepare('DELETE FROM push_subscriptions WHERE id = ?').run(sub.id);
      }
    }
  }
  return { sent, failed };
}
