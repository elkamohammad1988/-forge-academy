import { Router } from 'express';
import { z } from 'zod';
import { getDb, audit } from '../db.js';
import { requireAdmin } from '../middleware/auth.js';
import { EVENTS, dispatch } from '../lib/webhooks.js';

const router = Router();
router.use(requireAdmin);

const subSchema = z.object({
  url:     z.string().url().max(500),
  events:  z.string().min(1).max(500),
  secret:  z.string().max(120).optional().or(z.literal('')),
  active:  z.union([z.boolean(), z.literal(0), z.literal(1)]).optional(),
});

router.get('/events', (_req, res) => res.json({ ok: true, events: EVENTS }));

router.get('/', (_req, res) => {
  const subs = getDb().prepare('SELECT * FROM webhook_subscriptions ORDER BY created_at DESC').all();
  res.json({ ok: true, subscriptions: subs });
});

router.post('/', (req, res) => {
  const parsed = subSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ ok: false, error: 'Invalid input.', details: parsed.error.flatten() });
  const d = parsed.data;
  const r = getDb().prepare(`
    INSERT INTO webhook_subscriptions (url, events, secret, active, created_by)
    VALUES (?, ?, ?, ?, ?)
  `).run(d.url, d.events, d.secret || null, d.active === false ? 0 : 1, req.user.email);
  audit({ actor: req.user.email, action: 'webhook.created', entity_id: r.lastInsertRowid, ip: req.ip });
  res.json({ ok: true, id: r.lastInsertRowid });
});

router.patch('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const parsed = subSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ ok: false, error: 'Invalid input.' });
  const fields = []; const args = [];
  for (const [k, v] of Object.entries(parsed.data)) {
    if (v === undefined) continue;
    fields.push(`${k} = ?`);
    args.push(typeof v === 'boolean' ? (v ? 1 : 0) : v);
  }
  if (!fields.length) return res.json({ ok: true });
  args.push(id);
  getDb().prepare(`UPDATE webhook_subscriptions SET ${fields.join(', ')} WHERE id = ?`).run(...args);
  audit({ actor: req.user.email, action: 'webhook.updated', entity_id: id, ip: req.ip });
  res.json({ ok: true });
});

router.delete('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  getDb().prepare('DELETE FROM webhook_subscriptions WHERE id = ?').run(id);
  audit({ actor: req.user.email, action: 'webhook.deleted', entity_id: id, ip: req.ip });
  res.json({ ok: true });
});

router.post('/:id/test', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const sub = getDb().prepare('SELECT * FROM webhook_subscriptions WHERE id = ?').get(id);
  if (!sub) return res.status(404).json({ ok: false });
  dispatch('webhook.test', { id: sub.id, sentBy: req.user.email });
  audit({ actor: req.user.email, action: 'webhook.test', entity_id: id, ip: req.ip });
  res.json({ ok: true });
});

router.get('/:id/deliveries', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const rows = getDb().prepare(`
    SELECT * FROM webhook_deliveries WHERE subscription_id = ? ORDER BY created_at DESC LIMIT 100
  `).all(id);
  res.json({ ok: true, deliveries: rows });
});

export default router;
