-- Per-slot capacity overrides + waitlist support.
-- Default capacity comes from src/data/schedule.js (`capacity` field).
-- This table lets the owner override capacity for a specific (day, time) slot.

CREATE TABLE IF NOT EXISTS class_capacity (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  class_day  INTEGER NOT NULL,
  class_time TEXT NOT NULL,
  capacity   INTEGER NOT NULL,
  UNIQUE (class_day, class_time)
);

ALTER TABLE bookings ADD COLUMN waitlist_position INTEGER;
