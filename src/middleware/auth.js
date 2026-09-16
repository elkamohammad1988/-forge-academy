import { verifySession, COOKIE_NAME } from '../lib/auth.js';
import { getDb } from '../db.js';

export function loadSession(req, _res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  req.user = null;
  if (token) {
    const claims = verifySession(token);
    if (claims?.sub) {
      const member = getDb().prepare('SELECT id, email, first_name, last_name, plan, role FROM members WHERE id = ?').get(claims.sub);
      if (member) req.user = member;
    }
  }
  next();
}

export function requireMember(req, res, next) {
  if (!req.user) return res.status(401).json({ ok: false, error: 'Sign in required.' });
  next();
}

export function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ ok: false, error: 'Sign in required.' });
  if (req.user.role !== 'admin') return res.status(403).json({ ok: false, error: 'Admin only.' });
  next();
}
