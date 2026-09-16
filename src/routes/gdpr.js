/* GDPR / UK-GDPR data subject rights endpoints.
   - GET  /api/gdpr/me/export   — full data export (JSON download)
   - POST /api/gdpr/me/delete   — request account deletion (soft-delete, audited)
*/
import { Router } from 'express';
import { getDb, audit } from '../db.js';
import { requireMember } from '../middleware/auth.js';
import { COOKIE_NAME } from '../lib/auth.js';

const router = Router();
router.use(requireMember);

router.get('/me/export', (req, res) => {
  const db = getDb();
  const memberId = req.user.id;
  const dump = {
    exportedAt: new Date().toISOString(),
    member:      db.prepare('SELECT id, email, first_name, last_name, phone, plan, role, email_verified_at, created_at, last_login_at FROM members WHERE id = ?').get(memberId),
    bookings:    db.prepare('SELECT * FROM bookings    WHERE member_id = ?').all(memberId),
    attendance:  db.prepare(`
      SELECT a.*, b.starts_at, b.program FROM attendance a
      JOIN bookings b ON b.id = a.booking_id
      WHERE a.member_id = ?`).all(memberId),
    achievements: db.prepare('SELECT * FROM achievements WHERE member_id = ?').all(memberId),
    push_subscriptions: db.prepare('SELECT id, endpoint, created_at FROM push_subscriptions WHERE member_id = ?').all(memberId),
    leads_by_email:    db.prepare('SELECT * FROM leads    WHERE email = ?').all(req.user.email),
    contacts_by_email: db.prepare('SELECT * FROM contacts WHERE email = ?').all(req.user.email),
    newsletter:        db.prepare('SELECT * FROM newsletter WHERE email = ?').all(req.user.email),
  };

  audit({ actor: req.user.email, action: 'gdpr.export', entity_id: memberId, ip: req.ip });
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="forge-data-${memberId}-${Date.now()}.json"`);
  res.send(JSON.stringify(dump, null, 2));
});

router.post('/me/delete', (req, res) => {
  const db = getDb();
  const memberId = req.user.id;
  // Soft-delete: anonymise + revoke. Avoids cascading damage to historical
  // analytics (bookings still count toward gym stats), but no PII remains.
  const anonEmail = `deleted-${memberId}@anonymised.invalid`;
  db.transaction(() => {
    db.prepare(`
      UPDATE members
      SET email = ?, first_name = NULL, last_name = NULL, phone = NULL,
          password_hash = '__DELETED__', role = 'member', plan = NULL
      WHERE id = ?
    `).run(anonEmail, memberId);
    db.prepare('DELETE FROM auth_tokens WHERE member_id = ?').run(memberId);
    db.prepare('DELETE FROM push_subscriptions WHERE member_id = ?').run(memberId);
    db.prepare(`DELETE FROM newsletter WHERE email = ?`).run(req.user.email);
  })();
  audit({ actor: req.user.email, action: 'gdpr.deleted', entity_id: memberId, ip: req.ip });
  res.clearCookie(COOKIE_NAME, { path: '/' });
  res.json({ ok: true });
});

export default router;
