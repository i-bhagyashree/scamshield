import Database from 'better-sqlite3'
import { config } from './config.js'

export const db = new Database(config.dbPath)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT NOT NULL,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Every analysis. The raw text is stored only for signed-in users (for their history);
  -- anonymous checks keep only the result so that shared links never leak private messages.
  CREATE TABLE IF NOT EXISTS checks (
    id          TEXT PRIMARY KEY,
    user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
    input_text  TEXT,
    score       INTEGER NOT NULL,
    verdict     TEXT NOT NULL,
    category    TEXT NOT NULL,
    result_json TEXT NOT NULL,
    source      TEXT NOT NULL DEFAULT 'web',
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_checks_user ON checks(user_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_checks_created ON checks(created_at);

  -- Community reports of scam phone numbers, UPI IDs, websites and emails.
  CREATE TABLE IF NOT EXISTS reports (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
    type        TEXT NOT NULL CHECK (type IN ('phone','upi','url','email')),
    value       TEXT NOT NULL,
    category    TEXT NOT NULL,
    description TEXT NOT NULL,
    amount_lost INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_reports_value ON reports(type, value);
  CREATE INDEX IF NOT EXISTS idx_reports_created ON reports(created_at);

  -- "I got this too" confirmations. One per user per report.
  CREATE TABLE IF NOT EXISTS report_votes (
    report_id  INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (report_id, user_id)
  );

  -- Values a user wants to be alerted about if anyone reports them later.
  CREATE TABLE IF NOT EXISTS watchlist (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type       TEXT NOT NULL CHECK (type IN ('phone','upi','url','email')),
    value      TEXT NOT NULL,
    label      TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (user_id, type, value)
  );
  CREATE INDEX IF NOT EXISTS idx_watchlist_value ON watchlist(type, value);

  -- In-app notifications (watchlist hits, family circle alerts).
  CREATE TABLE IF NOT EXISTS notifications (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind       TEXT NOT NULL,
    title      TEXT NOT NULL,
    body       TEXT NOT NULL,
    link       TEXT,
    read_at    TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at);

  -- Family circles: members are alerted when someone in the circle checks a dangerous message.
  CREATE TABLE IF NOT EXISTS circles (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    code       TEXT NOT NULL UNIQUE,
    owner_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  -- user_id is UNIQUE: a user belongs to at most one circle.
  CREATE TABLE IF NOT EXISTS circle_members (
    circle_id INTEGER NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
    user_id   INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    joined_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (circle_id, user_id)
  );

  -- Cache of domain registration dates from RDAP, so we don't query the registry every time.
  CREATE TABLE IF NOT EXISTS domain_cache (
    domain        TEXT PRIMARY KEY,
    registered_at TEXT,
    checked_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );
`)

// Migration: anonymous device identities (no sign-up). Stores a SHA-256 hash of the browser's device ID.
const userColumns = db.prepare('PRAGMA table_info(users)').all() as Array<{ name: string }>
if (!userColumns.some((c) => c.name === 'device_hash')) {
  db.exec('ALTER TABLE users ADD COLUMN device_hash TEXT')
}
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_device ON users(device_hash)')

// Moderation: anyone can flag a report as wrong. See lib/moderation.ts for when a report is hidden.
db.exec(`
  CREATE TABLE IF NOT EXISTS report_flags (
    report_id  INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason     TEXT NOT NULL CHECK (reason IN ('wrong','spam','personal')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (report_id, user_id)
  );
`)
