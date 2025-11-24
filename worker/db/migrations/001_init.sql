CREATE TABLE IF NOT EXISTS stylists (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  display_name TEXT,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'stylist',
  password_hash TEXT NOT NULL,
  pin_hash TEXT NOT NULL,
  square_staff_id TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS stylist_notes (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL,
  stylist_id TEXT NOT NULL,
  stylist_name TEXT,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (stylist_id) REFERENCES stylists(id)
);

CREATE INDEX IF NOT EXISTS idx_notes_booking ON stylist_notes (booking_id, created_at DESC);

CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  name TEXT,
  email TEXT,
  phone TEXT,
  marketing_opt_in INTEGER NOT NULL DEFAULT 1,
  tags TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS sms_log (
  id TEXT PRIMARY KEY,
  campaign TEXT,
  contact_id TEXT,
  phone TEXT,
  message TEXT,
  status TEXT,
  response_sid TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
