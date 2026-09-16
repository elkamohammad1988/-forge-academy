-- Database-driven schedule (so admin can edit the timetable from the UI),
-- generic webhook subscriptions (any event → any URL), and a feature-flag
-- store the admin can toggle without redeploying.

CREATE TABLE IF NOT EXISTS schedule_classes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  day         INTEGER NOT NULL CHECK (day BETWEEN 0 AND 6),
  time        TEXT    NOT NULL,
  duration    INTEGER NOT NULL DEFAULT 60,
  prog        TEXT    NOT NULL,
  level       TEXT    NOT NULL DEFAULT 'All',
  coach       TEXT,
  title       TEXT    NOT NULL,
  capacity    INTEGER NOT NULL DEFAULT 20,
  active      INTEGER NOT NULL DEFAULT 1,
  position    INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_schedule_day_time ON schedule_classes(day, time);

CREATE TABLE IF NOT EXISTS webhook_subscriptions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  url         TEXT NOT NULL,
  events      TEXT NOT NULL,                  -- comma-separated, '*' for all
  secret      TEXT,
  active      INTEGER NOT NULL DEFAULT 1,
  created_by  TEXT,
  last_status INTEGER,
  last_at     TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  subscription_id INTEGER REFERENCES webhook_subscriptions(id) ON DELETE CASCADE,
  event           TEXT NOT NULL,
  payload         TEXT NOT NULL,
  status          INTEGER,
  response_body   TEXT,
  attempts        INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_sub ON webhook_deliveries(subscription_id);
