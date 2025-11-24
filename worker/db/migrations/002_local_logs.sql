CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  name TEXT,
  email TEXT,
  phone TEXT,
  source TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS bookings_local (
  id TEXT PRIMARY KEY,
  square_booking_id TEXT UNIQUE,
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  service_id TEXT,
  service_name TEXT,
  start_at TEXT,
  end_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
