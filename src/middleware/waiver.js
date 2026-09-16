/* Block class & PT bookings until the member has signed the active
 * liability waiver. Returns 412 Precondition Failed with a structured
 * payload so the frontend can route the user to /account.html#waiver
 * (or a dedicated sign page) instead of just showing an error toast.
 *
 * Admin and coach roles are exempt — they're staff, not booking members.
 */
import { getDb } from '../db.js';

export function requireSignedWaiver(req, res, next) {
  if (!req.user) return res.status(401).json({ ok: false, error: 'Sign in required.' });
  if (['admin', 'coach'].includes(req.user.role)) return next();

  const w = getDb().prepare(`SELECT id FROM waivers WHERE active = 1 ORDER BY id DESC LIMIT 1`).get();
  if (!w) return next(); // no active waiver configured — don't block

  const sig = getDb().prepare(`
    SELECT id FROM waiver_signatures WHERE member_id = ? AND waiver_id = ? LIMIT 1
  `).get(req.user.id, w.id);

  if (sig) return next();

  return res.status(412).json({
    ok: false,
    error: 'Please sign the liability waiver before booking.',
    needs_waiver: true,
    waiver_id: w.id,
  });
}
