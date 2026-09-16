/* Digital liability waivers — legally required for every gym.
   Members sign once per active waiver version; signature is a base64 PNG
   from a canvas plus IP + user-agent + timestamp for an audit trail.
*/
import { Router } from 'express';
import { z } from 'zod';
import { getDb, audit } from '../db.js';
import { requireMember, requireAdmin } from '../middleware/auth.js';

const router = Router();

// Public: fetch the current active waiver
router.get('/current', (_req, res) => {
  const w = getDb().prepare(`SELECT * FROM waivers WHERE active = 1 ORDER BY id DESC LIMIT 1`).get();
  if (!w) return res.status(404).json({ ok: false, error: 'No active waiver.' });
  res.json({ ok: true, waiver: w });
});

// Member: do I need to sign?
router.get('/me/status', requireMember, (req, res) => {
  const w = getDb().prepare(`SELECT * FROM waivers WHERE active = 1 ORDER BY id DESC LIMIT 1`).get();
  if (!w) return res.json({ ok: true, signed: true });
  const sig = getDb().prepare(`
    SELECT * FROM waiver_signatures WHERE member_id = ? AND waiver_id = ?
    ORDER BY signed_at DESC LIMIT 1
  `).get(req.user.id, w.id);
  res.json({
    ok: true,
    waiver: w,
    signed: !!sig,
    signed_at: sig ? sig.signed_at : null,
  });
});

// Member: sign
const signSchema = z.object({
  signer_name: z.string().trim().min(1).max(120),
  signature_dataurl: z.string().regex(/^data:image\/(png|jpeg);base64,/).max(200_000),
  for_minor_dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')),
  parent_signer: z.string().max(120).optional().or(z.literal('')),
});
router.post('/sign', requireMember, (req, res) => {
  const parsed = signSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ ok: false, error: 'Invalid signature.', details: parsed.error.flatten() });
  const w = getDb().prepare(`SELECT * FROM waivers WHERE active = 1 ORDER BY id DESC LIMIT 1`).get();
  if (!w) return res.status(404).json({ ok: false, error: 'No active waiver.' });

  // One signature per (member, waiver). Upsert via insert + ignore-on-conflict
  const existing = getDb().prepare(`SELECT id FROM waiver_signatures WHERE member_id = ? AND waiver_id = ?`).get(req.user.id, w.id);
  if (existing) return res.status(409).json({ ok: false, error: 'Already signed.', id: existing.id });

  const r = getDb().prepare(`
    INSERT INTO waiver_signatures
      (waiver_id, member_id, signer_email, signer_name, signature_dataurl,
       ip, user_agent, for_minor_dob, parent_signer)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    w.id, req.user.id, req.user.email, parsed.data.signer_name, parsed.data.signature_dataurl,
    req.ip, req.get('user-agent') || '', parsed.data.for_minor_dob || null, parsed.data.parent_signer || null,
  );
  audit({ actor: req.user.email, action: 'waiver.signed', entity: 'waiver', entity_id: w.id, ip: req.ip });
  res.json({ ok: true, id: r.lastInsertRowid });
});

// Admin: list all signatures (for audit / liability evidence)
router.get('/signatures', requireAdmin, (_req, res) => {
  const rows = getDb().prepare(`
    SELECT s.id, s.waiver_id, s.signer_email, s.signer_name, s.signed_at, s.ip,
           w.version, w.title, m.id AS member_id
    FROM waiver_signatures s
    JOIN waivers w ON w.id = s.waiver_id
    LEFT JOIN members m ON m.id = s.member_id
    ORDER BY s.signed_at DESC LIMIT 500
  `).all();
  res.json({ ok: true, signatures: rows });
});

router.get('/signatures/:id', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const row = getDb().prepare(`
    SELECT s.*, w.version, w.title, w.body_md
    FROM waiver_signatures s JOIN waivers w ON w.id = s.waiver_id
    WHERE s.id = ?
  `).get(id);
  if (!row) return res.status(404).json({ ok: false });
  res.json({ ok: true, signature: row });
});

// Admin: publish a new waiver version
const newSchema = z.object({
  version: z.string().min(1).max(40),
  title:   z.string().min(1).max(200),
  body_md: z.string().min(20).max(50_000),
});
router.post('/', requireAdmin, (req, res) => {
  const parsed = newSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ ok: false, error: 'Invalid input.' });
  const db = getDb();
  // Deactivate previous active waivers atomically
  db.transaction(() => {
    db.prepare(`UPDATE waivers SET active = 0 WHERE active = 1`).run();
    db.prepare(`INSERT INTO waivers (version, title, body_md, active, created_by) VALUES (?, ?, ?, 1, ?)`)
      .run(parsed.data.version, parsed.data.title, parsed.data.body_md, req.user.email);
  })();
  audit({ actor: req.user.email, action: 'waiver.published', meta: { version: parsed.data.version } });
  res.json({ ok: true });
});

export default router;
