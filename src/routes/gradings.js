/* Belt grading / rank progression. Admins (or coaches) award promotions;
   members see their lifetime rank timeline.
*/
import { Router } from 'express';
import { z } from 'zod';
import { getDb, audit } from '../db.js';
import { requireMember, requireAdmin } from '../middleware/auth.js';
import { sendMail } from '../lib/email.js';

const router = Router();

const DISCIPLINES = ['BJJ', 'MuayThai', 'Boxing', 'Karate'];

const RANKS = {
  BJJ:      ['White','Blue','Purple','Brown','Black','1st Degree Black','2nd Degree Black','3rd Degree Black'],
  MuayThai: ['White prajioud','Yellow prajioud','Green prajioud','Blue prajioud','Red prajioud','Brown prajioud','Black prajioud','Silver prajioud','Gold prajioud'],
  Boxing:   ['Beginner','Improver','Sparrer','Competitor','Open class'],
  Karate:   ['10th Kyu (White)','9th Kyu (Yellow)','8th Kyu (Orange)','7th Kyu (Green)','6th Kyu (Blue)','5th Kyu (Purple)','4th Kyu (Brown)','3rd Kyu','2nd Kyu','1st Kyu','1st Dan','2nd Dan','3rd Dan','4th Dan','5th Dan'],
};

router.get('/ranks', (_req, res) => {
  res.json({ ok: true, disciplines: DISCIPLINES, ranks: RANKS });
});

// Member: my full timeline + current rank per discipline
router.get('/me', requireMember, (req, res) => {
  const rows = getDb().prepare(`
    SELECT * FROM gradings WHERE member_id = ?
    ORDER BY awarded_on ASC, id ASC
  `).all(req.user.id);

  const current = {};
  for (const g of rows) current[g.discipline] = g;
  res.json({ ok: true, timeline: rows, current });
});

// Admin: timeline for any member
router.get('/member/:id', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const member = getDb().prepare('SELECT id, email, first_name, last_name FROM members WHERE id = ?').get(id);
  if (!member) return res.status(404).json({ ok: false });
  const rows = getDb().prepare(`SELECT * FROM gradings WHERE member_id = ? ORDER BY awarded_on ASC`).all(id);
  res.json({ ok: true, member, timeline: rows });
});

// Admin: grant a grading (creates a new row; doesn't overwrite history)
const grantSchema = z.object({
  member_id:  z.coerce.number().int(),
  discipline: z.enum(DISCIPLINES),
  rank:       z.string().min(1).max(60),
  stripes:    z.coerce.number().int().min(0).max(10).default(0),
  awarded_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes:      z.string().max(500).optional().or(z.literal('')),
});
router.post('/grant', requireAdmin, (req, res) => {
  const parsed = grantSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ ok: false, error: 'Invalid input.', details: parsed.error.flatten() });
  const d = parsed.data;
  const member = getDb().prepare('SELECT email, first_name FROM members WHERE id = ?').get(d.member_id);
  if (!member) return res.status(404).json({ ok: false });
  const r = getDb().prepare(`
    INSERT INTO gradings (member_id, discipline, rank, stripes, awarded_by, awarded_on, notes)
    VALUES (?, ?, ?, ?, ?, COALESCE(?, date('now')), ?)
  `).run(d.member_id, d.discipline, d.rank, d.stripes, req.user.email, d.awarded_on || null, d.notes || null);

  audit({ actor: req.user.email, action: 'grading.granted', entity_id: d.member_id, meta: { discipline: d.discipline, rank: d.rank, stripes: d.stripes }, ip: req.ip });

  sendMail({
    to: member.email,
    subject: `Promoted: ${d.rank}${d.stripes ? ` · ${d.stripes} stripe${d.stripes > 1 ? 's' : ''}` : ''} in ${d.discipline}`,
    text: `Hi ${member.first_name || 'there'},\n\nYou've been promoted to ${d.rank}${d.stripes ? ` with ${d.stripes} stripe${d.stripes > 1 ? 's' : ''}` : ''} in ${d.discipline}. Earned through hard work — see you on the mats.\n\n— Forge Manchester`,
  }).catch(() => {});

  res.json({ ok: true, id: r.lastInsertRowid });
});

router.delete('/:id', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  getDb().prepare('DELETE FROM gradings WHERE id = ?').run(id);
  audit({ actor: req.user.email, action: 'grading.deleted', entity_id: id, ip: req.ip });
  res.json({ ok: true });
});

export default router;
