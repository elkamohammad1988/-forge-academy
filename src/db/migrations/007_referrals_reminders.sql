-- Member referral program (referrer earns a credit when referred friend joins)
-- + reminder log so we don't double-send a class reminder.

CREATE TABLE IF NOT EXISTS referrals (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  referrer_id     INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  referrer_code   TEXT    NOT NULL,
  referred_email  TEXT    NOT NULL,
  referred_id     INTEGER REFERENCES members(id) ON DELETE SET NULL,
  status          TEXT    NOT NULL DEFAULT 'pending',  -- 'pending' | 'joined' | 'paid' | 'rewarded'
  credit_months   INTEGER NOT NULL DEFAULT 0,
  joined_at       TEXT,
  paid_at         TEXT,
  rewarded_at     TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_email    ON referrals(referred_email);
CREATE INDEX IF NOT EXISTS idx_referrals_code     ON referrals(referrer_code);

-- Credit ledger: every awarded month creates one row.
-- Negative entries == credits spent.
CREATE TABLE IF NOT EXISTS member_credits (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id    INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  months       INTEGER NOT NULL,
  reason       TEXT NOT NULL,
  ref_id       INTEGER,                 -- optional FK back to referrals
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_credits_member ON member_credits(member_id);

-- Track that we've already sent a reminder for a given booking
ALTER TABLE bookings ADD COLUMN reminder_sent_at TEXT;

-- Persist the per-member referral code so it stays stable
ALTER TABLE members ADD COLUMN referral_code TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_members_referral_code ON members(referral_code) WHERE referral_code IS NOT NULL;
