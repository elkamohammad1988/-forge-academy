// Reject same-site forgery: only allow POST/PUT/DELETE from configured origins.
export function checkOrigin(req, res, next) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
  const allowed = (process.env.ALLOWED_ORIGINS || '')
    .split(',').map((s) => s.trim()).filter(Boolean);
  if (!allowed.length) return next(); // allow-all if not configured (dev convenience)

  const origin = req.headers.origin || req.headers.referer || '';
  if (!origin) return res.status(403).json({ ok: false, error: 'Origin required.' });
  const ok = allowed.some((a) => origin.startsWith(a));
  if (!ok) return res.status(403).json({ ok: false, error: 'Cross-origin request blocked.' });
  next();
}
