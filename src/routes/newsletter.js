import { Router } from 'express';
import { getDb, audit } from '../db.js';
import { newsletterSchema, ageOk } from '../lib/validators.js';

const router = Router();

router.post('/', (req, res) => {
  const parsed = newsletterSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ ok: false, error: 'Invalid email.' });
  const d = parsed.data;
  if (d.website) return res.json({ ok: true });
  if (!ageOk(d._ts))   return res.json({ ok: true });

  try {
    getDb().prepare(`
      INSERT INTO newsletter (email, ip) VALUES (?, ?)
      ON CONFLICT(email) DO UPDATE SET unsubscribed_at = NULL
    `).run(d.email, req.ip);
    audit({ action: 'newsletter.subscribed', entity: 'newsletter', meta: { email: d.email }, ip: req.ip });
    res.json({ ok: true });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('newsletter error', err);
    res.status(500).json({ ok: false, error: 'Could not subscribe.' });
  }
});

router.post('/unsubscribe', (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!email) return res.status(422).json({ ok: false });
  getDb().prepare(`UPDATE newsletter SET unsubscribed_at = datetime('now') WHERE email = ?`).run(email);
  res.json({ ok: true });
});

export default router;
