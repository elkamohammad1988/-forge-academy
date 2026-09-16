import { Router } from 'express';
import { z } from 'zod';
import { getDb, audit } from '../db.js';
import { registerSchema, loginSchema } from '../lib/validators.js';
import {
  hashPassword, checkPassword, signSession, COOKIE_NAME, cookieOptions,
} from '../lib/auth.js';
import { issueToken, consumeToken } from '../lib/tokens.js';
import { sendMail } from '../lib/email.js';
import { passwordResetEmail, emailVerificationEmail } from '../lib/email-templates.js';
import { requireMember } from '../middleware/auth.js';
import { onMemberJoined } from '../lib/referrals.js';
import { dispatch as dispatchWebhook } from '../lib/webhooks.js';
import { generateSecret, verifyCode, otpauthUrl, makeRecoveryCodes } from '../lib/totp.js';
import bcrypt from 'bcryptjs';

const router = Router();

function publicUrl() {
  return (process.env.PUBLIC_URL || 'http://localhost:3000').replace(/\/$/, '');
}

router.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ ok: false, error: 'Invalid input.', details: parsed.error.flatten() });
  const d = parsed.data;
  const db = getDb();
  if (db.prepare('SELECT id FROM members WHERE email = ?').get(d.email)) {
    return res.status(409).json({ ok: false, error: 'An account already exists for that email.' });
  }
  const r = db.prepare(`
    INSERT INTO members (email, password_hash, first_name, last_name)
    VALUES (?, ?, ?, ?)
  `).run(d.email, hashPassword(d.password), d.firstName, d.lastName || null);

  const token = signSession({ sub: r.lastInsertRowid, email: d.email, role: 'member' });
  res.cookie(COOKIE_NAME, token, cookieOptions(req));
  audit({ actor: d.email, action: 'auth.register', entity: 'member', entity_id: r.lastInsertRowid, ip: req.ip });

  // Attribute referral if the cookie/query carried one
  try {
    const ref = req.cookies?.forge_ref || req.body?.ref;
    if (ref) onMemberJoined({ id: r.lastInsertRowid, email: d.email }, ref);
  } catch {}
  dispatchWebhook('member.registered', { id: r.lastInsertRowid, email: d.email, firstName: d.firstName });

  // Send verification email (fire-and-forget)
  try {
    const verifyToken = issueToken(r.lastInsertRowid, 'verify');
    const link = `${publicUrl()}/account.html?verify=${encodeURIComponent(verifyToken)}`;
    sendMail({
      to: d.email,
      ...emailVerificationEmail({ first_name: d.firstName }, link),
    }).catch(() => {});
  } catch { /* email is not gating — surface verify state in UI later */ }

  res.json({ ok: true, member: { id: r.lastInsertRowid, email: d.email, firstName: d.firstName } });
});

router.post('/login', (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ ok: false, error: 'Invalid input.' });
  const d = parsed.data;
  const member = getDb().prepare('SELECT * FROM members WHERE email = ?').get(d.email);

  const dummyHash = '$2a$12$abcdefghijklmnopqrstuv0123456789ABCDEFGHIJKLMNOPQRST';
  const ok = checkPassword(d.password, member?.password_hash || dummyHash);

  if (!member || !ok) {
    audit({ actor: d.email, action: 'auth.login.failed', ip: req.ip });
    return res.status(401).json({ ok: false, error: 'Invalid email or password.' });
  }

  // 2FA gate — if enabled, require a TOTP or recovery code
  const tfa = getDb().prepare(`SELECT * FROM member_2fa WHERE member_id = ? AND enabled_at IS NOT NULL`).get(member.id);
  if (tfa) {
    const code = String(req.body.totp_code || '').replace(/\s/g, '');
    const recovery = String(req.body.recovery_code || '').replace(/\s/g, '').toUpperCase();
    let pass = code && verifyCode(tfa.secret_b32, code);
    if (!pass && recovery) {
      const codes = JSON.parse(tfa.recovery_codes || '[]');
      const idx = codes.findIndex((c) => c.hash && bcrypt.compareSync(recovery, c.hash) && !c.used);
      if (idx >= 0) {
        codes[idx].used = new Date().toISOString();
        getDb().prepare(`UPDATE member_2fa SET recovery_codes = ? WHERE member_id = ?`).run(JSON.stringify(codes), member.id);
        pass = true;
      }
    }
    if (!pass) {
      audit({ actor: d.email, action: 'auth.login.totp_required', ip: req.ip });
      return res.status(401).json({ ok: false, error: '2FA code required.', needs_totp: true });
    }
  }

  getDb().prepare(`UPDATE members SET last_login_at = datetime('now') WHERE id = ?`).run(member.id);
  const token = signSession({ sub: member.id, email: member.email, role: member.role });
  res.cookie(COOKIE_NAME, token, cookieOptions(req));
  audit({ actor: member.email, action: 'auth.login.ok', entity: 'member', entity_id: member.id, ip: req.ip });
  res.json({
    ok: true,
    member: {
      id: member.id, email: member.email,
      firstName: member.first_name, lastName: member.last_name,
      plan: member.plan, role: member.role,
      emailVerified: !!member.email_verified_at,
      twoFactorEnabled: !!tfa,
    },
  });
});

// ─── Two-factor authentication (TOTP) ─────────────────────────────────────
router.get('/2fa/status', requireMember, (req, res) => {
  const tfa = getDb().prepare(`SELECT enabled_at FROM member_2fa WHERE member_id = ?`).get(req.user.id);
  res.json({ ok: true, enabled: !!(tfa && tfa.enabled_at), pending: !!(tfa && !tfa.enabled_at) });
});

router.post('/2fa/setup', requireMember, (req, res) => {
  const secret = generateSecret();
  const url = otpauthUrl(secret, req.user.email, 'Forge');
  getDb().prepare(`
    INSERT INTO member_2fa (member_id, secret_b32, recovery_codes)
    VALUES (?, ?, '[]')
    ON CONFLICT(member_id) DO UPDATE SET secret_b32 = excluded.secret_b32, enabled_at = NULL, recovery_codes = '[]'
  `).run(req.user.id, secret);
  res.json({ ok: true, secret, otpauth_url: url });
});

router.post('/2fa/enable', requireMember, (req, res) => {
  const code = String(req.body.code || '').replace(/\s/g, '');
  const tfa = getDb().prepare(`SELECT * FROM member_2fa WHERE member_id = ?`).get(req.user.id);
  if (!tfa) return res.status(404).json({ ok: false, error: 'Run /2fa/setup first.' });
  if (!verifyCode(tfa.secret_b32, code)) return res.status(401).json({ ok: false, error: 'Code didn\'t match. Try again.' });
  const recoveryPlain = makeRecoveryCodes(10);
  const recoveryHashed = recoveryPlain.map((c) => ({ hash: bcrypt.hashSync(c, 10), used: false }));
  getDb().prepare(`UPDATE member_2fa SET enabled_at = datetime('now'), recovery_codes = ? WHERE member_id = ?`)
    .run(JSON.stringify(recoveryHashed), req.user.id);
  audit({ actor: req.user.email, action: 'auth.2fa.enabled', ip: req.ip });
  res.json({ ok: true, recovery_codes: recoveryPlain });
});

router.post('/2fa/disable', requireMember, (req, res) => {
  const code = String(req.body.code || '').replace(/\s/g, '');
  const tfa = getDb().prepare(`SELECT * FROM member_2fa WHERE member_id = ?`).get(req.user.id);
  if (!tfa || !tfa.enabled_at) return res.json({ ok: true });
  if (!verifyCode(tfa.secret_b32, code)) return res.status(401).json({ ok: false, error: 'Code didn\'t match.' });
  getDb().prepare(`DELETE FROM member_2fa WHERE member_id = ?`).run(req.user.id);
  audit({ actor: req.user.email, action: 'auth.2fa.disabled', ip: req.ip });
  res.json({ ok: true });
});

router.post('/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME, { path: '/' });
  if (req.user) audit({ actor: req.user.email, action: 'auth.logout', entity_id: req.user.id, ip: req.ip });
  res.json({ ok: true });
});

router.get('/me', (req, res) => {
  if (!req.user) return res.json({ ok: true, member: null });
  const m = getDb().prepare('SELECT * FROM members WHERE id = ?').get(req.user.id);
  res.json({
    ok: true,
    member: m ? {
      id: m.id, email: m.email,
      firstName: m.first_name, lastName: m.last_name, phone: m.phone,
      plan: m.plan, role: m.role,
      emailVerified: !!m.email_verified_at,
      createdAt: m.created_at, lastLoginAt: m.last_login_at,
    } : null,
  });
});

// ─── Email verification ────────────────────────────────────────────────────
router.post('/verify-email/resend', requireMember, async (req, res) => {
  const m = getDb().prepare('SELECT * FROM members WHERE id = ?').get(req.user.id);
  if (m.email_verified_at) return res.json({ ok: true, alreadyVerified: true });
  const token = issueToken(m.id, 'verify');
  const link  = `${publicUrl()}/account.html?verify=${encodeURIComponent(token)}`;
  await sendMail({ to: m.email, ...emailVerificationEmail(m, link) }).catch(() => {});
  res.json({ ok: true });
});

router.post('/verify-email', (req, res) => {
  const token = String(req.body?.token || '').trim();
  if (!token) return res.status(422).json({ ok: false, error: 'Missing token.' });
  const row = consumeToken(token, 'verify');
  if (!row) return res.status(400).json({ ok: false, error: 'Link expired or already used.' });
  getDb().prepare(`UPDATE members SET email_verified_at = datetime('now') WHERE id = ?`).run(row.member_id);
  audit({ action: 'auth.email.verified', entity: 'member', entity_id: row.member_id, ip: req.ip });
  res.json({ ok: true });
});

// ─── Password reset ────────────────────────────────────────────────────────
router.post('/forgot', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!email) return res.status(422).json({ ok: false, error: 'Missing email.' });
  const m = getDb().prepare('SELECT * FROM members WHERE email = ?').get(email);

  // Always return ok — don't leak account existence
  if (m) {
    const token = issueToken(m.id, 'reset');
    const link  = `${publicUrl()}/account.html?reset=${encodeURIComponent(token)}`;
    sendMail({ to: m.email, ...passwordResetEmail(m, link) }).catch(() => {});
    audit({ actor: email, action: 'auth.reset.requested', entity_id: m.id, ip: req.ip });
  }
  res.json({ ok: true });
});

const resetSchema = z.object({
  token:    z.string().min(10).max(200),
  password: z.string().min(8).max(128),
});

router.post('/reset', (req, res) => {
  const parsed = resetSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ ok: false, error: 'Invalid input.' });
  const { token, password } = parsed.data;
  const row = consumeToken(token, 'reset');
  if (!row) return res.status(400).json({ ok: false, error: 'Reset link expired or already used.' });
  getDb().prepare(`UPDATE members SET password_hash = ? WHERE id = ?`).run(hashPassword(password), row.member_id);
  audit({ action: 'auth.reset.ok', entity: 'member', entity_id: row.member_id, ip: req.ip });
  res.json({ ok: true });
});

// ─── Profile ───────────────────────────────────────────────────────────────
const profileSchema = z.object({
  firstName: z.string().trim().min(1).max(80).optional(),
  lastName:  z.string().trim().max(80).optional().or(z.literal('')),
  phone:     z.string().trim().max(40).optional().or(z.literal('')),
});

router.patch('/profile', requireMember, (req, res) => {
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ ok: false, error: 'Invalid input.' });
  const d = parsed.data;
  const sets = [], args = [];
  if (d.firstName !== undefined) { sets.push('first_name = ?'); args.push(d.firstName); }
  if (d.lastName  !== undefined) { sets.push('last_name = ?');  args.push(d.lastName || null); }
  if (d.phone     !== undefined) { sets.push('phone = ?');      args.push(d.phone || null); }
  if (!sets.length) return res.json({ ok: true });
  args.push(req.user.id);
  getDb().prepare(`UPDATE members SET ${sets.join(', ')} WHERE id = ?`).run(...args);
  audit({ actor: req.user.email, action: 'auth.profile.updated', entity_id: req.user.id, ip: req.ip });
  res.json({ ok: true });
});

const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword:     z.string().min(8).max(128),
});

router.post('/change-password', requireMember, (req, res) => {
  const parsed = passwordChangeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ ok: false, error: 'Invalid input.' });
  const m = getDb().prepare('SELECT password_hash FROM members WHERE id = ?').get(req.user.id);
  if (!checkPassword(parsed.data.currentPassword, m.password_hash)) {
    return res.status(401).json({ ok: false, error: 'Current password is wrong.' });
  }
  getDb().prepare('UPDATE members SET password_hash = ? WHERE id = ?').run(hashPassword(parsed.data.newPassword), req.user.id);
  audit({ actor: req.user.email, action: 'auth.password.changed', entity_id: req.user.id, ip: req.ip });
  res.json({ ok: true });
});

export default router;
