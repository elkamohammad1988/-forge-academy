/* Referral program — track who brought who, reward credits when the
   referred member converts. Codes are stable per member, generated on demand.
*/
import { randomBytes } from 'node:crypto';
import { getDb, audit } from './../db.js';

function ensureCode(memberId) {
  const db = getDb();
  const row = db.prepare('SELECT referral_code, first_name FROM members WHERE id = ?').get(memberId);
  if (!row) return null;
  if (row.referral_code) return row.referral_code;
  // Stable, human-friendly: first-name + 4 random chars
  const slug = (row.first_name || 'friend').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12) || 'friend';
  let attempt = 0, code;
  while (attempt < 5) {
    code = slug + '-' + randomBytes(2).toString('hex');
    try { db.prepare('UPDATE members SET referral_code = ? WHERE id = ?').run(code, memberId); break; }
    catch { attempt++; }
  }
  return code;
}

export function getOrIssueCode(memberId) {
  return ensureCode(memberId);
}

// Called when a NEW member registers — link them to their referrer if a
// referral cookie/query was carried through.
export function onMemberJoined(member, refSource) {
  if (!refSource) return;
  const db = getDb();
  // Match either a member's stable code or a one-off email referral
  const referrer = db.prepare('SELECT * FROM members WHERE referral_code = ?').get(refSource);
  if (!referrer || referrer.id === member.id) return;

  const exists = db.prepare(`SELECT id FROM referrals WHERE referrer_id = ? AND referred_email = ?`).get(referrer.id, member.email);
  if (exists) return;

  db.prepare(`
    INSERT INTO referrals (referrer_id, referrer_code, referred_email, referred_id, status, joined_at)
    VALUES (?, ?, ?, ?, 'joined', datetime('now'))
  `).run(referrer.id, refSource, member.email, member.id);
  audit({ actor: member.email, action: 'referral.joined', entity_id: referrer.id });
}

// Called when a member's plan changes to a paid plan
export function onMemberPaid(memberId) {
  const db = getDb();
  const ref = db.prepare(`
    SELECT * FROM referrals WHERE referred_id = ? AND status IN ('joined','pending')
  `).get(memberId);
  if (!ref) return;

  const months = parseInt(process.env.REFERRAL_CREDIT_MONTHS || '1', 10);
  const requirePaid = process.env.REFERRAL_REQUIRES_PAID !== 'false';
  if (requirePaid) {
    db.prepare(`UPDATE referrals SET status = 'paid', paid_at = datetime('now') WHERE id = ?`).run(ref.id);
  }
  // Award credit (idempotent — once per referral)
  db.transaction(() => {
    db.prepare(`
      INSERT INTO member_credits (member_id, months, reason, ref_id)
      VALUES (?, ?, ?, ?)
    `).run(ref.referrer_id, months, 'referral:' + ref.referred_email, ref.id);
    db.prepare(`UPDATE referrals SET status = 'rewarded', credit_months = ?, rewarded_at = datetime('now') WHERE id = ?`).run(months, ref.id);
  })();
  audit({ action: 'referral.rewarded', entity_id: ref.referrer_id, meta: { months, referred: ref.referred_email } });
}

export function balanceFor(memberId) {
  const r = getDb().prepare(`SELECT COALESCE(SUM(months),0) AS m FROM member_credits WHERE member_id = ?`).get(memberId);
  return r.m;
}

export function listFor(memberId) {
  return getDb().prepare(`
    SELECT id, referred_email, status, credit_months, joined_at, paid_at, rewarded_at, created_at
    FROM referrals WHERE referrer_id = ? ORDER BY created_at DESC LIMIT 100
  `).all(memberId);
}

export function ledgerFor(memberId) {
  return getDb().prepare(`
    SELECT id, months, reason, created_at FROM member_credits WHERE member_id = ? ORDER BY created_at DESC LIMIT 100
  `).all(memberId);
}
