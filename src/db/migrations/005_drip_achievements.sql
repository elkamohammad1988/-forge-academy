-- Email drip automation: queue + send-log + sequence definitions.
-- Member achievements: badges + streaks.
-- Web push subscriptions for class reminders.

CREATE TABLE IF NOT EXISTS email_queue (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  to_email     TEXT NOT NULL,
  subject      TEXT NOT NULL,
  text         TEXT,
  html         TEXT,
  send_after   TEXT NOT NULL DEFAULT (datetime('now')),
  attempts     INTEGER NOT NULL DEFAULT 0,
  sent_at      TEXT,
  failed_at    TEXT,
  failure      TEXT,
  source       TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_queue_due ON email_queue(send_after, sent_at);

CREATE TABLE IF NOT EXISTS achievements (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id    INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  code         TEXT NOT NULL,                 -- e.g. 'first-class', 'week-streak-1', 'classes-25'
  earned_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (member_id, code)
);
CREATE INDEX IF NOT EXISTS idx_achievements_member ON achievements(member_id);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id    INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  endpoint     TEXT NOT NULL UNIQUE,
  p256dh       TEXT NOT NULL,
  auth         TEXT NOT NULL,
  user_agent   TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_push_member ON push_subscriptions(member_id);
