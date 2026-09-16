-- Personal Training (PT): coaches publish availability slots, members book
-- a paid 1-on-1 session.
CREATE TABLE IF NOT EXISTS pt_slots (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  coach_id     INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  starts_at    TEXT    NOT NULL,
  duration     INTEGER NOT NULL DEFAULT 60,
  price_pence  INTEGER NOT NULL DEFAULT 5000,         -- £50.00
  notes        TEXT,
  status       TEXT    NOT NULL DEFAULT 'open',       -- 'open' | 'booked' | 'cancelled' | 'completed'
  member_id    INTEGER REFERENCES members(id) ON DELETE SET NULL,
  paid_at      TEXT,
  stripe_session_id TEXT,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_pt_starts ON pt_slots(starts_at);
CREATE INDEX IF NOT EXISTS idx_pt_coach  ON pt_slots(coach_id);

-- Belt grading history. Each row is one promotion event.
CREATE TABLE IF NOT EXISTS gradings (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id     INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  discipline    TEXT NOT NULL,                        -- 'BJJ' | 'MuayThai' | 'Boxing' | 'Karate'
  rank          TEXT NOT NULL,                        -- 'White', 'Blue', '4th Stripe', etc.
  stripes       INTEGER DEFAULT 0,
  awarded_by    TEXT NOT NULL,
  awarded_on    TEXT NOT NULL DEFAULT (date('now')),
  notes         TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_gradings_member ON gradings(member_id, discipline);

-- Membership pauses: vacations, injuries, finance.
CREATE TABLE IF NOT EXISTS member_pauses (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id    INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  starts_on    TEXT NOT NULL,
  ends_on      TEXT NOT NULL,
  reason       TEXT,
  status       TEXT NOT NULL DEFAULT 'active',       -- 'requested' | 'active' | 'ended' | 'cancelled'
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_pauses_member ON member_pauses(member_id, status);

-- Day passes (drop-in tokens): bought via Stripe, redeemable for one class.
CREATE TABLE IF NOT EXISTS day_passes (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id    INTEGER REFERENCES members(id) ON DELETE SET NULL,
  email        TEXT NOT NULL,
  code         TEXT UNIQUE NOT NULL,
  paid_at      TEXT,
  redeemed_at  TEXT,
  redeemed_for_booking INTEGER REFERENCES bookings(id),
  stripe_session_id TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_passes_email ON day_passes(email);
CREATE INDEX IF NOT EXISTS idx_passes_code  ON day_passes(code);
