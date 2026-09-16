-- Password reset + email verification tokens.
-- Tokens are stored as SHA-256 hashes — only the raw token leaves the server,
-- inside a one-time email link. We never store the raw token.

CREATE TABLE IF NOT EXISTS auth_tokens (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id   INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL,            -- 'reset' | 'verify'
  token_hash  TEXT NOT NULL UNIQUE,
  expires_at  TEXT NOT NULL,
  used_at     TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_auth_tokens_member ON auth_tokens(member_id, kind);
CREATE INDEX IF NOT EXISTS idx_auth_tokens_hash   ON auth_tokens(token_hash);

CREATE TABLE IF NOT EXISTS lead_notes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id    INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  author     TEXT NOT NULL,
  body       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_lead_notes_lead ON lead_notes(lead_id);
