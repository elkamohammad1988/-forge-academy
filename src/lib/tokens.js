import { randomBytes, createHash } from 'node:crypto';
import { getDb } from '../db.js';

const TOKEN_BYTES = 32;
const RESET_TTL_MIN = 60;        // 1 hour
const VERIFY_TTL_MIN = 60 * 24;  // 24 hours

export function hashToken(raw) {
  return createHash('sha256').update(raw).digest('hex');
}

export function issueToken(memberId, kind) {
  const ttl = kind === 'reset' ? RESET_TTL_MIN : VERIFY_TTL_MIN;
  const raw = randomBytes(TOKEN_BYTES).toString('base64url');
  const hash = hashToken(raw);
  const expires = new Date(Date.now() + ttl * 60 * 1000).toISOString();
  // Invalidate any prior tokens of the same kind for this member
  getDb().prepare('DELETE FROM auth_tokens WHERE member_id = ? AND kind = ?').run(memberId, kind);
  getDb().prepare(`
    INSERT INTO auth_tokens (member_id, kind, token_hash, expires_at)
    VALUES (?, ?, ?, ?)
  `).run(memberId, kind, hash, expires);
  return raw;
}

export function consumeToken(raw, kind) {
  const hash = hashToken(raw);
  const row = getDb().prepare(`
    SELECT * FROM auth_tokens
    WHERE token_hash = ? AND kind = ? AND used_at IS NULL AND expires_at > datetime('now')
  `).get(hash, kind);
  if (!row) return null;
  getDb().prepare(`UPDATE auth_tokens SET used_at = datetime('now') WHERE id = ?`).run(row.id);
  return row;
}
