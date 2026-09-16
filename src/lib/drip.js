/* Email drip automation.
   Sequences are functions that take a lead and return a list of
   { offsetMinutes, subject, text, html? } steps. They get queued at
   lead-creation time and sent by a small worker that wakes up every 60s.
*/
import { getDb } from '../db.js';
import { sendMail } from './email.js';
import { getBrand } from './brand.js';

// ─── Sequence definitions ─────────────────────────────────────────────────
function trialSequence(lead) {
  const b = getBrand();
  const url = (b.url || '').replace(/\/$/, '');
  return [
    {
      offsetMinutes: 60 * 24 * 1,
      subject: `${lead.first_name}, did you make it to your trial?`,
      text:
`Hi ${lead.first_name},

Just checking in — did you book a slot for your free trial yet? If you'd like a hand picking a class that fits, hit reply and we'll suggest one based on your goals.

If you've already trained — welcome! What did you think?

— Forge Manchester
${url}/schedule.html`,
    },
    {
      offsetMinutes: 60 * 24 * 3,
      subject: `Three things every beginner gets right at Forge`,
      text:
`Hi ${lead.first_name},

A short note from one of our coaches:

  1. Show up early. Ten minutes makes all the difference.
  2. Tell us if anything hurts. We'll modify on the spot.
  3. Don't try to "win" your first sparring round. Survival is the goal.

Most members find their second class easier than the first. The third class is when it clicks.

Pick your next slot here: ${url}/schedule.html

— Forge Manchester`,
    },
    {
      offsetMinutes: 60 * 24 * 7,
      subject: `Your second free week is still on us, ${lead.first_name}`,
      text:
`Hi ${lead.first_name},

Quick reminder — your free trial runs for two full weeks, not one. That's enough time to try every discipline at Forge if you want.

If you've been once, try a different class next. BJJ → Muay Thai is the most popular combo with our beginners.

Pricing for after the trial is here: ${url}/pricing.html — no contract, cancel any time.

— Forge Manchester`,
    },
    {
      offsetMinutes: 60 * 24 * 14,
      subject: `Did Forge work for you? (And: a 2-week extension if not)`,
      text:
`Hi ${lead.first_name},

Two weeks have flown by. If Forge clicked, sign up here: ${url}/pricing.html

If something held you back — coach mismatch, schedule, nerves, anything — reply to this email and we'll fix it. We'd rather extend your trial by another two weeks than lose you.

— Forge Manchester
P.S. Bring a friend — their first class is also free.`,
    },
  ];
}

const SEQUENCES = {
  'trial': trialSequence,
};

export function enqueueSequence(lead, name) {
  const fn = SEQUENCES[name];
  if (!fn) return 0;
  const steps = fn(lead);
  const stmt = getDb().prepare(`
    INSERT INTO email_queue (to_email, subject, text, html, send_after, source)
    VALUES (?, ?, ?, ?, datetime('now', '+' || ? || ' minutes'), ?)
  `);
  for (const s of steps) {
    stmt.run(lead.email, s.subject, s.text, s.html || null, s.offsetMinutes, name + ':' + lead.id);
  }
  return steps.length;
}

// ─── Worker — drains the queue every 60 seconds ───────────────────────────
let _worker = null;

export function startDripWorker() {
  if (_worker) return;
  const db = getDb();
  const tick = async () => {
    try {
      const due = db.prepare(`
        SELECT * FROM email_queue
        WHERE sent_at IS NULL AND failed_at IS NULL
          AND send_after <= datetime('now')
          AND attempts < 3
        ORDER BY send_after ASC LIMIT 25
      `).all();
      for (const row of due) {
        try {
          // eslint-disable-next-line no-await-in-loop
          await sendMail({ to: row.to_email, subject: row.subject, text: row.text, html: row.html || undefined });
          db.prepare(`UPDATE email_queue SET sent_at = datetime('now'), attempts = attempts + 1 WHERE id = ?`).run(row.id);
        } catch (e) {
          db.prepare(`UPDATE email_queue SET attempts = attempts + 1, failure = ?, failed_at = CASE WHEN attempts + 1 >= 3 THEN datetime('now') ELSE NULL END WHERE id = ?`).run(e.message, row.id);
        }
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('drip worker error', e);
    }
  };
  // Don't block startup: defer first tick by 5 seconds
  setTimeout(tick, 5000);
  _worker = setInterval(tick, 60_000);
}

export function stopDripWorker() {
  if (_worker) { clearInterval(_worker); _worker = null; }
}
