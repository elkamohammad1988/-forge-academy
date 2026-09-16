import { Router } from 'express';
import { z } from 'zod';
import { getDb, audit } from '../db.js';
import { requireMember } from '../middleware/auth.js';
import { isConfigured, publicKey, pushToMember } from '../lib/push.js';

const router = Router();

router.get('/public-key', (_req, res) => {
  res.json({ ok: true, publicKey: publicKey(), enabled: isConfigured() });
});

const subSchema = z.object({
  endpoint: z.string().url().max(500),
  keys: z.object({
    p256dh: z.string().min(40).max(200),
    auth:   z.string().min(8).max(60),
  }),
});

router.post('/subscribe', requireMember, (req, res) => {
  const parsed = subSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ ok: false, error: 'Invalid subscription.' });
  const { endpoint, keys } = parsed.data;
  const ua = req.get('user-agent') || '';
  getDb().prepare(`
    INSERT INTO push_subscriptions (member_id, endpoint, p256dh, auth, user_agent)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(endpoint) DO UPDATE SET member_id = excluded.member_id, p256dh = excluded.p256dh, auth = excluded.auth, user_agent = excluded.user_agent
  `).run(req.user.id, endpoint, keys.p256dh, keys.auth, ua);
  audit({ actor: req.user.email, action: 'push.subscribed', entity_id: req.user.id, ip: req.ip });
  res.json({ ok: true });
});

router.post('/unsubscribe', requireMember, (req, res) => {
  const endpoint = String(req.body?.endpoint || '').trim();
  if (!endpoint) return res.status(422).json({ ok: false });
  getDb().prepare('DELETE FROM push_subscriptions WHERE endpoint = ? AND member_id = ?').run(endpoint, req.user.id);
  res.json({ ok: true });
});

router.post('/test', requireMember, async (req, res) => {
  if (!isConfigured()) return res.status(503).json({ ok: false, error: 'Push not configured on the server.' });
  const r = await pushToMember(req.user.id, {
    title: 'Forge — push works ✅',
    body:  'You\'ll get class reminders 60 min before each booking.',
    url:   '/account.html',
  });
  res.json({ ok: true, ...r });
});

export default router;
