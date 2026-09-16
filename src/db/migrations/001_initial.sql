-- Initial schema. Mirrors what was inlined in src/db.js — kept here as the
-- canonical source of truth from now on.

CREATE TABLE IF NOT EXISTS leads (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name  TEXT NOT NULL,
  last_name   TEXT,
  email       TEXT NOT NULL,
  phone       TEXT,
  age         TEXT,
  experience  TEXT,
  program     TEXT,
  preferred_day  TEXT,
  preferred_time TEXT,
  hear_about  TEXT,
  notes       TEXT,
  consent     INTEGER DEFAULT 0,
  source      TEXT DEFAULT 'website',
  referrer    TEXT,
  ip          TEXT,
  user_agent  TEXT,
  status      TEXT NOT NULL DEFAULT 'new',
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);

CREATE TABLE IF NOT EXISTS contacts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL,
  phone      TEXT,
  topic      TEXT,
  message    TEXT NOT NULL,
  ip         TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS newsletter (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  email           TEXT UNIQUE NOT NULL,
  ip              TEXT,
  unsubscribed_at TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS members (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  email               TEXT UNIQUE NOT NULL,
  password_hash       TEXT NOT NULL,
  first_name          TEXT,
  last_name           TEXT,
  phone               TEXT,
  plan                TEXT,
  role                TEXT NOT NULL DEFAULT 'member',
  stripe_customer_id  TEXT,
  email_verified_at   TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  last_login_at       TEXT
);
CREATE INDEX IF NOT EXISTS idx_members_email ON members(email);

CREATE TABLE IF NOT EXISTS bookings (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id   INTEGER REFERENCES members(id) ON DELETE SET NULL,
  lead_id     INTEGER REFERENCES leads(id) ON DELETE SET NULL,
  class_day   INTEGER NOT NULL,
  class_time  TEXT NOT NULL,
  program     TEXT NOT NULL,
  starts_at   TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'confirmed',
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_bookings_member ON bookings(member_id);
CREATE INDEX IF NOT EXISTS idx_bookings_starts ON bookings(starts_at);
CREATE INDEX IF NOT EXISTS idx_bookings_class  ON bookings(class_day, class_time, starts_at);

CREATE TABLE IF NOT EXISTS audit_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  actor       TEXT,
  action      TEXT NOT NULL,
  entity      TEXT,
  entity_id   INTEGER,
  meta        TEXT,
  ip          TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
