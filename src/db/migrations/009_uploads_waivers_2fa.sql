-- ─── File uploads (gallery photos, coach avatars, blog images) ───────────
CREATE TABLE IF NOT EXISTS uploads (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  filename     TEXT NOT NULL,
  mime         TEXT NOT NULL,
  size_bytes   INTEGER NOT NULL,
  path         TEXT NOT NULL,                -- relative path in /data/uploads
  kind         TEXT NOT NULL,                -- 'gallery' | 'coach' | 'blog' | 'misc'
  related_id   INTEGER,                      -- coach id, blog post slug-hash, etc.
  caption      TEXT,
  width        INTEGER,
  height       INTEGER,
  uploaded_by  TEXT,
  active       INTEGER NOT NULL DEFAULT 1,
  position     INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_uploads_kind     ON uploads(kind, active, position);
CREATE INDEX IF NOT EXISTS idx_uploads_related  ON uploads(kind, related_id);

-- ─── Digital waivers (legal requirement at every real gym) ──────────────
CREATE TABLE IF NOT EXISTS waivers (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  version      TEXT NOT NULL UNIQUE,         -- e.g. '1.0', '2024-09'
  title        TEXT NOT NULL,
  body_md      TEXT NOT NULL,
  active       INTEGER NOT NULL DEFAULT 1,
  created_by   TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS waiver_signatures (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  waiver_id     INTEGER NOT NULL REFERENCES waivers(id) ON DELETE RESTRICT,
  member_id     INTEGER REFERENCES members(id) ON DELETE SET NULL,
  signer_email  TEXT NOT NULL,
  signer_name   TEXT NOT NULL,
  signature_dataurl TEXT,                    -- base64 PNG data: from canvas
  ip            TEXT,
  user_agent    TEXT,
  for_minor_dob TEXT,                        -- when signing for under-18
  parent_signer TEXT,
  signed_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_waiver_sig_member ON waiver_signatures(member_id, waiver_id);
CREATE INDEX IF NOT EXISTS idx_waiver_sig_email  ON waiver_signatures(signer_email);

-- ─── Two-factor authentication (TOTP) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS member_2fa (
  member_id        INTEGER PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE,
  secret_b32       TEXT NOT NULL,            -- base32-encoded TOTP secret
  enabled_at       TEXT,                     -- null while user is in setup
  recovery_codes   TEXT NOT NULL,            -- JSON array of one-shot codes (hashed)
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─── Webhook retry queue ───────────────────────────────────────────────
ALTER TABLE webhook_deliveries ADD COLUMN next_attempt_at TEXT;
CREATE INDEX IF NOT EXISTS idx_webhook_due ON webhook_deliveries(next_attempt_at, status);

-- Seed a default waiver so the app boots with one usable
INSERT INTO waivers (version, title, body_md, active, created_by)
SELECT '1.0', 'Forge Martial Arts — Liability Waiver',
'## Forge Martial Arts Academy — Liability Waiver and Release

I understand that participation in martial arts training carries an inherent
risk of physical injury. By signing below I acknowledge:

1. **Voluntary participation.** I am training of my own free will and have
   disclosed any pre-existing medical conditions to my coach.
2. **Assumption of risk.** I accept that bruises, sprains and occasional
   injuries can occur even with the safest coaching.
3. **Insurance.** Forge holds public liability insurance; I have my own
   personal medical/health cover where needed.
4. **Conduct.** I will follow the zero-ego rule, the coach''s instructions,
   and any safety guidance posted in the academy.
5. **Photography.** Forge may take photos in classes for marketing; I can
   opt out at any time by emailing hello@forgemartialarts.co.uk.
6. **Minors.** A parent or legal guardian must sign on behalf of any member
   under 18 years old.

I have read and understood this waiver and sign below as confirmation.
', 1, 'system'
WHERE NOT EXISTS (SELECT 1 FROM waivers WHERE version = '1.0');
