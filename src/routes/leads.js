import { Router } from 'express';
import { getDb, audit } from '../db.js';
import { leadSchema, ageOk } from '../lib/validators.js';
import { sendMail } from '../lib/email.js';
import { leadConfirmation, leadOwnerNotification } from '../lib/email-templates.js';
import { notifyNewLead } from '../lib/notify.js';
import { broadcastSSE } from './sse.js';
import { enqueueSequence } from '../lib/drip.js';
import { dispatch as dispatchWebhook } from '../lib/webhooks.js';

const router = Router();

router.post('/', async (req, res) => {
  const parsed = leadSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(422).json({ ok: false, error: 'Invalid input.', details: parsed.error.flatten() });
  }
  const data = parsed.data;
  if (data.website) return res.json({ ok: true, id: 0 });
  if (!ageOk(data._ts))   return res.json({ ok: true, id: 0 });

  const ip = req.ip;
  const ua = req.get('user-agent') || '';
  const consent = data.consent === true || data.consent === 'on' || data.consent === 'true' ? 1 : 0;

  try {
    const stmt = getDb().prepare(`
      INSERT INTO leads
        (first_name, last_name, email, phone, age, experience, program,
         preferred_day, preferred_time, hear_about, notes, consent,
         referrer, ip, user_agent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const r = stmt.run(
      data.firstName, data.lastName || null, data.email, data.phone || null,
      data.age || null, data.experience || null, data.program || null,
      data.preferredDay || null, data.preferredTime || null,
      data.hearAbout || null, data.notes || null, consent,
      data.referrer || null, ip, ua,
    );

    const lead = {
      id: r.lastInsertRowid,
      first_name: data.firstName, last_name: data.lastName,
      email: data.email, phone: data.phone, program: data.program,
      preferred_day: data.preferredDay, preferred_time: data.preferredTime,
      experience: data.experience, hear_about: data.hearAbout,
      referrer: data.referrer, notes: data.notes, created_at: new Date().toISOString(),
    };
    audit({ action: 'lead.created', entity: 'lead', entity_id: r.lastInsertRowid, ip });

    // Push live admin notification + chat-platform pings + emails (fire-and-forget)
    Promise.allSettled([
      sendMail({ to: process.env.EMAIL_TO_OWNER || 'hello@forgemartialarts.co.uk', replyTo: data.email, ...leadOwnerNotification(lead) }),
      sendMail({ to: data.email, ...leadConfirmation(lead) }),
      notifyNewLead(lead),
    // eslint-disable-next-line no-console
    ]).catch((err) => console.error('notify error', err));
    broadcastSSE('lead', lead);
    dispatchWebhook('lead.created', lead);

    // Enqueue the 4-step welcome / nudge / kit / win-back drip
    try { enqueueSequence(lead, 'trial'); } catch {}

    return res.json({ ok: true, id: r.lastInsertRowid });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('lead error', err);
    return res.status(500).json({ ok: false, error: 'Could not save your booking. Please try again or call.' });
  }
});

export default router;
