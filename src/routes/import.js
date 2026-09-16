/* CSV import for admins. Currently supports:
   - members:    columns email,first_name,last_name,phone,plan
   - newsletter: column  email
   Body is plain CSV (Content-Type text/csv or application/csv).
   First row is treated as the header.
*/
import { Router } from 'express';
import express from 'express';
import { getDb, audit } from '../db.js';
import { hashPassword } from '../lib/auth.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();
router.use(requireAdmin);

function parseCSV(raw) {
  // Tiny RFC-4180-ish parser — handles quoted fields with commas.
  const out = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (inQuotes) {
      if (c === '"' && raw[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\r') {}
      else if (c === '\n') { row.push(field); out.push(row); row = []; field = ''; }
      else field += c;
    }
  }
  if (field.length || row.length) { row.push(field); out.push(row); }
  return out.filter((r) => r.length > 1 || (r.length === 1 && r[0].trim()));
}

router.post('/members',
  express.text({ type: ['text/csv', 'application/csv', 'text/plain'], limit: '2mb' }),
  (req, res) => {
    const rows = parseCSV(req.body || '');
    if (!rows.length) return res.status(422).json({ ok: false, error: 'Empty CSV.' });
    const header = rows[0].map((h) => h.trim().toLowerCase());
    const idx = (k) => header.indexOf(k);
    if (idx('email') < 0) return res.status(422).json({ ok: false, error: 'CSV must have an "email" column.' });

    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO members (email, password_hash, first_name, last_name, phone, plan)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(email) DO UPDATE SET
        first_name = COALESCE(excluded.first_name, first_name),
        last_name  = COALESCE(excluded.last_name,  last_name),
        phone      = COALESCE(excluded.phone,      phone),
        plan       = COALESCE(excluded.plan,       plan)
    `);
    let inserted = 0, skipped = 0;
    const tx = db.transaction(() => {
      for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        const email = (row[idx('email')] || '').trim().toLowerCase();
        if (!email || !email.includes('@')) { skipped++; continue; }
        try {
          stmt.run(
            email,
            '__IMPORTED__' + Date.now(),
            idx('first_name') >= 0 ? (row[idx('first_name')] || null) : null,
            idx('last_name')  >= 0 ? (row[idx('last_name')]  || null) : null,
            idx('phone')      >= 0 ? (row[idx('phone')]      || null) : null,
            idx('plan')       >= 0 ? (row[idx('plan')]       || null) : null,
          );
          inserted++;
        } catch { skipped++; }
      }
    });
    tx();
    audit({ actor: req.user.email, action: 'import.members', meta: { inserted, skipped }, ip: req.ip });
    res.json({ ok: true, inserted, skipped, total: rows.length - 1 });
  }
);

router.post('/newsletter',
  express.text({ type: ['text/csv', 'application/csv', 'text/plain'], limit: '2mb' }),
  (req, res) => {
    const rows = parseCSV(req.body || '');
    if (!rows.length) return res.status(422).json({ ok: false, error: 'Empty CSV.' });
    const header = rows[0].map((h) => h.trim().toLowerCase());
    const ei = header.indexOf('email');
    if (ei < 0) return res.status(422).json({ ok: false, error: 'CSV must have an "email" column.' });
    const db = getDb();
    const stmt = db.prepare(`INSERT INTO newsletter (email) VALUES (?) ON CONFLICT(email) DO UPDATE SET unsubscribed_at = NULL`);
    let inserted = 0;
    db.transaction(() => {
      for (let r = 1; r < rows.length; r++) {
        const e = (rows[r][ei] || '').trim().toLowerCase();
        if (e && e.includes('@')) { stmt.run(e); inserted++; }
      }
    })();
    audit({ actor: req.user.email, action: 'import.newsletter', meta: { inserted }, ip: req.ip });
    res.json({ ok: true, inserted });
  }
);

export default router;
