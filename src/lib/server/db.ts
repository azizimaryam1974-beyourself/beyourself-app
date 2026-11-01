import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { BOOKING_SCHEMA, seedBookingDefaults } from "./booking-schema";
import { CHAT_SCHEMA } from "./chat";
import { RECEIPT_SCHEMA } from "./receipts";
import { DETAILS_SCHEMA } from "./user-details";

/**
 * SQLite reicht für eine Fahrschule locker aus (eine Datei, einfache
 * Sicherung). Die Datei liegt unter DATABASE_PATH, im Container /app/data.
 */
const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name          TEXT NOT NULL,
  phone         TEXT,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('student','teacher')),
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS language_packages (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  school_id    TEXT NOT NULL,
  language     TEXT NOT NULL,
  price_cents  INTEGER NOT NULL,
  status       TEXT NOT NULL CHECK (status IN ('booked','paid','cancelled')),
  booked_at    TEXT NOT NULL,
  paid_at      TEXT,
  cancelled_at TEXT,
  terms_accepted_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pkg_user ON language_packages(user_id);

CREATE TABLE IF NOT EXISTS lessons (
  id         TEXT PRIMARY KEY,
  title      TEXT NOT NULL,
  status     TEXT NOT NULL CHECK (status IN ('planned','live','ended')),
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  started_at TEXT,
  ended_at   TEXT
);

CREATE TABLE IF NOT EXISTS password_resets (
  token_hash TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_by TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at    INTEGER
);

CREATE TABLE IF NOT EXISTS lesson_segments (
  lesson_id    TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  seq          INTEGER NOT NULL,
  original     TEXT NOT NULL,
  translations TEXT NOT NULL,
  at           TEXT NOT NULL,
  PRIMARY KEY (lesson_id, seq)
);
`;

export function openDatabase(file: string): Database.Database {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
  db.exec(BOOKING_SCHEMA);
  db.exec(CHAT_SCHEMA);
  db.exec(RECEIPT_SCHEMA);
  db.exec(DETAILS_SCHEMA);
  seedBookingDefaults(db);
  return db;
}

const g = globalThis as unknown as { __beyourselfDb?: Database.Database };

export function db(): Database.Database {
  if (!g.__beyourselfDb) g.__beyourselfDb = openDatabase(process.env.DATABASE_PATH || "./data/beyourself.db");
  return g.__beyourselfDb;
}
