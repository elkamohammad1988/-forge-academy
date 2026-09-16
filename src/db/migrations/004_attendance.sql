-- Class roster + check-in. Each booking can be marked attended / no-show by a coach.
-- Coaches are members with role = 'coach' (or 'admin').

CREATE TABLE IF NOT EXISTS attendance (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id   INTEGER NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE CASCADE,
  member_id    INTEGER REFERENCES members(id) ON DELETE SET NULL,
  status       TEXT NOT NULL CHECK (status IN ('attended','no-show','late','excused')),
  checked_in_at TEXT NOT NULL DEFAULT (datetime('now')),
  checked_in_by INTEGER REFERENCES members(id) ON DELETE SET NULL,
  notes        TEXT
);
CREATE INDEX IF NOT EXISTS idx_attendance_member  ON attendance(member_id);
CREATE INDEX IF NOT EXISTS idx_attendance_booking ON attendance(booking_id);

-- One-time check-in tokens used by the QR code workflow. The coach scans a
-- member's QR (or pastes the code) to confirm attendance — token rotates on
-- use. Tokens are short-lived and member-scoped.
CREATE TABLE IF NOT EXISTS checkin_tokens (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id   INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  token       TEXT UNIQUE NOT NULL,
  expires_at  TEXT NOT NULL,
  used_at     TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_checkin_token ON checkin_tokens(token);
