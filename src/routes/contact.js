import { Router } from 'express';
import { getDb, audit } from '../db.js';
import { contactSchema, ageOk } from '../lib/validators.js';
import { sendMail } from '../lib/email.js';
import { broadcastSSE } from './sse.js';
import { dispatch as dispatchWebhook } from '../lib/webhooks.js';

const router = Router();

router.post('/', async (req, res) => {
  const parsed = contactSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(422).json({ ok: false, error: 'Invalid input.', details: parsed.error.flatten() });
  }
  const d = parsed.data;
  if (d.website) return res.json({ ok: true });
  if (!ageOk(d._ts))   return res.json({ ok: true });

  try {
    const stmt = getDb().prepare(`
      INSERT INTO contacts (name, email, phone, topic, message, ip, user_agent)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const r = stmt.run(d.firstName, d.email, d.phone || null, d.topic || null, d.message, req.ip, req.get('user-agent') || '');
    audit({ action: 'contact.created', entity: 'contact', entity_id: r.lastInsertRowid, ip: req.ip });
    const event = { id: r.lastInsertRowid, name: d.firstName, email: d.email, topic: d.topic, created_at: new Date().toISOString() };
    broadcastSSE('contact', event);
    dispatchWebhook('contact.created', event);

    Promise.allSettled([
      sendMail({
        to: process.env.EMAIL_TO_OWNER || 'hello@forgemartialarts.co.uk',
        replyTo: d.email,
        subject: `Contact form — ${d.topic || 'general'}`,
        text: `From: ${d.firstName} <${d.email}>\nPhone: ${d.phone || '—'}\nTopic: ${d.topic || '—'}\n\n${d.message}`,
      }),
    // eslint-disable-next-line no-console
    ]).catch((err) => console.error('email error', err));

    return res.json({ ok: true });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('contact error', err);
    return res.status(500).json({ ok: false, error: 'Could not send your message. Please try again.' });
  }
});

export default router;
