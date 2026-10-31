import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { CATALOG, CATALOG_IDS } from "../catalog";

/**
 * Online-Buchung: Angebote (mit Preis), freigegebene Termine, Buchungen/Bestellungen,
 * Nachrichten an Schüler, Textvorlagen und Einstellungen.
 * Zeiten als Millisekunden (UTC), Geld in Cent.
 */
export const BOOKING_SCHEMA = `
CREATE TABLE IF NOT EXISTS offers (
  id             TEXT PRIMARY KEY,
  kind           TEXT NOT NULL CHECK (kind IN ('slot','product','language')),
  title          TEXT NOT NULL,
  description    TEXT NOT NULL DEFAULT '',
  duration_min   INTEGER NOT NULL DEFAULT 0,
  price_cents    INTEGER NOT NULL DEFAULT 0,
  needs_approval INTEGER NOT NULL DEFAULT 1,
  active         INTEGER NOT NULL DEFAULT 1,
  sort           INTEGER NOT NULL DEFAULT 0,
  created_at     INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS slots (
  id         TEXT PRIMARY KEY,
  offer_id   TEXT NOT NULL REFERENCES offers(id),
  starts_at  INTEGER NOT NULL,
  ends_at    INTEGER NOT NULL,
  status     TEXT NOT NULL CHECK (status IN ('open','reserved','booked','closed')),
  note       TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_slots_time ON slots(starts_at);

CREATE TABLE IF NOT EXISTS bookings (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id),
  offer_id      TEXT NOT NULL REFERENCES offers(id),
  slot_id       TEXT REFERENCES slots(id),
  package_id    TEXT,
  title         TEXT NOT NULL,
  price_cents   INTEGER NOT NULL,
  status        TEXT NOT NULL CHECK (status IN ('requested','declined','awaiting_payment','expired','paid','cancelled','withdrawn')),
  student_note  TEXT NOT NULL DEFAULT '',
  admin_message TEXT NOT NULL DEFAULT '',
  created_at    INTEGER NOT NULL,
  decided_at    INTEGER,
  pay_deadline  INTEGER,
  paid_at       INTEGER,
  cancelled_at  INTEGER,
  cancelled_by  TEXT,
  refund_cents  INTEGER NOT NULL DEFAULT 0,
  provider      TEXT,
  provider_ref  TEXT,
  provider_payment TEXT,
  terms_at      INTEGER,
  reminded      INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_slot ON bookings(slot_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);

CREATE TABLE IF NOT EXISTS notifications (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  booking_id TEXT,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  read_at    INTEGER
);
CREATE INDEX IF NOT EXISTS idx_notes_user ON notifications(user_id, created_at);

CREATE TABLE IF NOT EXISTS templates (
  id    TEXT PRIMARY KEY,
  kind  TEXT NOT NULL CHECK (kind IN ('confirm','decline','cancel')),
  label TEXT NOT NULL,
  body  TEXT NOT NULL,
  sort  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS training_profiles (
  user_id          TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  license_class    TEXT NOT NULL CHECK (license_class IN ('b','b197','b78','umschreibung')),
  practice_target  INTEGER,
  repeat_target    INTEGER NOT NULL DEFAULT 3,
  extra_manual     INTEGER NOT NULL DEFAULT 0,
  testfahrt_passed_at INTEGER,
  exam_ready_at    INTEGER,
  theory_passed_at INTEGER,
  sehtest_at       INTEGER,
  erste_hilfe_at   INTEGER,
  antrag_at        INTEGER,
  pruefauftrag_at  INTEGER,
  manual_approval  INTEGER NOT NULL DEFAULT 0,
  blocked          INTEGER NOT NULL DEFAULT 0,
  max_per_week     INTEGER NOT NULL DEFAULT 2,
  teacher_note     TEXT NOT NULL DEFAULT '',
  updated_at       INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS drive_records (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL,
  minutes    INTEGER NOT NULL CHECK (minutes BETWEEN 15 AND 240),
  at         INTEGER NOT NULL,
  status     TEXT NOT NULL CHECK (status IN ('planned','done','no_show','late')),
  booking_id TEXT,
  source     TEXT NOT NULL DEFAULT 'manual',
  note       TEXT NOT NULL DEFAULT '',
  created_by TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_drive_user ON drive_records(user_id, at);

CREATE TABLE IF NOT EXISTS work_template (
  teacher_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  weekday    INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 5),
  start_min  INTEGER NOT NULL,
  end_min    INTEGER NOT NULL,
  PRIMARY KEY (teacher_id, weekday, start_min)
);

CREATE TABLE IF NOT EXISTS day_overrides (
  teacher_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day        TEXT NOT NULL,
  ranges     TEXT NOT NULL,
  PRIMARY KEY (teacher_id, day)
);

CREATE TABLE IF NOT EXISTS blocks (
  id         TEXT PRIMARY KEY,
  teacher_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  starts_at  INTEGER NOT NULL,
  ends_at    INTEGER NOT NULL,
  note       TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_blocks_time ON blocks(starts_at);

CREATE TABLE IF NOT EXISTS payment_events (
  id TEXT PRIMARY KEY,
  at INTEGER NOT NULL
);
`;

const DEFAULT_OFFERS: Array<[string, string, string, number, number, number]> = [
  // kind, title, description, minutes, needs_approval, active – Fahrten und Gebühren kommen aus OFFERS_V2
  ["language", "Sprachpaket Live-Übersetzung", "Theorieunterricht live übersetzt in deine Sprache.", 0, 0, 1],
];

const DEFAULT_TEMPLATES: Array<[string, string, string]> = [
  ["confirm", "Standard", "Deine Fahrstunde ist bestätigt. Bitte bezahle sie innerhalb der Frist, dann ist der Termin fest für dich reserviert."],
  ["confirm", "Treffpunkt Fahrschule", "Deine Fahrstunde ist bestätigt. Wir treffen uns direkt vor der Fahrschule. Bitte bring deinen Ausweis mit."],
  ["confirm", "Abholung", "Deine Fahrstunde ist bestätigt. Ich hole dich an der vereinbarten Adresse ab."],
  ["decline", "Termin vergeben", "Dieser Termin ist leider schon vergeben. Bitte wähle einen anderen freien Termin."],
  ["decline", "Erst Theorie", "Für diese Fahrstunde fehlt noch der Theorieunterricht bzw. die Grundlagen. Bitte melde dich kurz bei mir."],
  ["decline", "Zu viele Anfragen", "Du hast bereits mehrere Termine in dieser Woche. Bitte wähle einen Termin in einer anderen Woche."],
  ["cancel", "Krankheit", "Ich muss diesen Termin leider krankheitsbedingt absagen. Den Betrag bekommst du vollständig zurück."],
  ["cancel", "Fahrzeug", "Ich muss diesen Termin leider absagen, weil das Fahrzeug nicht zur Verfügung steht. Den Betrag bekommst du vollständig zurück."],
  ["cancel", "Wetter", "Wegen der Wetterlage muss ich diesen Termin leider absagen. Den Betrag bekommst du vollständig zurück."],
];

/** Frühe Version (31.10.) zählte in 45-Min-Einheiten → auf Minuten umstellen. */
function migrate(db: Database.Database): void {
  const cols = db.prepare(`PRAGMA table_info(drive_records)`).all() as Array<{ name: string }>;
  if (cols.some((c) => c.name === "units") && !cols.some((c) => c.name === "minutes")) {
    db.exec(`ALTER TABLE drive_records RENAME TO drive_records_old`);
    db.exec(BOOKING_SCHEMA);
    db.exec(`INSERT INTO drive_records (id,user_id,kind,minutes,at,status,booking_id,source,note,created_by,created_at)
             SELECT id,user_id,kind,units*45,at,status,booking_id,source,note,created_by,created_at FROM drive_records_old`);
    db.exec(`DROP TABLE drive_records_old`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_drive_user ON drive_records(user_id, at)`);
  }
}

/** Fahrstunden-Preise (je 45 Min) und Gebühren laut Preisliste vom 31.10.2026. */
const OFFERS_V2: Array<[string, string, string, string, number, number, number]> = [
  // id, kind, title, description, duration, price, active
  ["drive-uebung", "slot", "Übungsfahrt", "Preis je 45 Min – buchbar 60, 75 oder 90 Min (anteilig).", 45, 6800, 1],
  ["drive-sonder", "slot", "Sonderfahrt (Überland, Autobahn, Beleuchtung)", "Preis je 45 Min – buchbar 60, 75, 90 Min, Beleuchtung auch 135 Min.", 45, 7500, 1],
  ["drive-testfahrt", "slot", "Testfahrt (B197)", "30 Min. Bei 45 Min gilt der Übungsfahrt-Preis.", 30, 4500, 1],
  ["drive-warmstunde", "slot", "Warmstunde vor der Prüfung", "30 Min, Termin legt die Fahrschule fest.", 30, 4500, 1],
  ["fee-grundbetrag", "product", "Grundbetrag", "Anmeldung, Theorieunterricht und Verwaltung.", 0, 52000, 0],
  ["fee-pruefung", "product", "Vorstellung zur praktischen Prüfung", "Gebühr der Fahrschule.", 0, 20000, 0],
  ["fee-theorie", "product", "Vorstellung zur Theorieprüfung", "Gebühr der Fahrschule.", 0, 7000, 0],
  ["fee-tuev-praxis", "product", "TÜV-Gebühr praktische Prüfung", "Wird an den TÜV weitergeleitet.", 0, 12983, 0],
  ["fee-tuev-theorie", "product", "TÜV-Gebühr Theorieprüfung", "Wird an den TÜV weitergeleitet.", 0, 2499, 0],
];

function addColumn(db: Database.Database, table: string, col: string, def: string): void {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === col)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
}

export function seedBookingDefaults(db: Database.Database): void {
  migrate(db);
  // Fahrten aus dem Kalender: Art, Länge, Treffpunkt
  addColumn(db, "bookings", "kind", "TEXT");
  addColumn(db, "bookings", "minutes", "INTEGER");
  addColumn(db, "bookings", "meeting_point", "TEXT NOT NULL DEFAULT ''");
  const now = Date.now();
  const hasOffers = (db.prepare(`SELECT COUNT(*) AS n FROM offers`).get() as { n: number }).n > 0;
  if (!hasOffers) {
    const ins = db.prepare(
      `INSERT INTO offers (id,kind,title,description,duration_min,price_cents,needs_approval,active,sort,created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
    );
    DEFAULT_OFFERS.forEach(([kind, title, desc, min, appr, active], i) => {
      // Preise trägt die Fahrschule selbst ein; nur das Sprachpaket hat einen festen Preis.
      const price = kind === "language" ? 3000 : 0;
      ins.run(kind === "language" ? "sprachpaket" : randomUUID(), kind, title, desc, min, price, appr, active, i, now);
    });
  }
  const hasTemplates = (db.prepare(`SELECT COUNT(*) AS n FROM templates`).get() as { n: number }).n > 0;
  if (!hasTemplates) {
    const ins = db.prepare(`INSERT INTO templates (id,kind,label,body,sort) VALUES (?,?,?,?,?)`);
    DEFAULT_TEMPLATES.forEach(([kind, label, body], i) => ins.run(randomUUID(), kind, label, body, i));
  }
  const v2 = db.prepare(`SELECT value FROM settings WHERE key = 'offers_v2'`).get();
  if (!v2) {
    db.transaction(() => {
      // Alte Beispiel-Angebote (vor der Preisliste) abschalten, Sprachpaket bleibt.
      db.prepare(`UPDATE offers SET active = 0 WHERE id != 'sprachpaket' AND id NOT LIKE 'drive-%' AND id NOT LIKE 'fee-%'`).run();
      const ins = db.prepare(`INSERT OR IGNORE INTO offers (id,kind,title,description,duration_min,price_cents,needs_approval,active,sort,created_at) VALUES (?,?,?,?,?,?,0,?,?,?)`);
      OFFERS_V2.forEach(([id, kind, title, desc, dur, price, active], i) => ins.run(id, kind, title, desc, dur, price, active, i - 20, Date.now()));
      db.prepare(`INSERT INTO settings (key,value) VALUES ('offers_v2','1')`).run();
    })();
  }
  // v3 (31.10.2026): feste Preisliste mit Beschreibungen; alte Beispiel-Angebote löschen.
  if (!db.prepare(`SELECT 1 FROM settings WHERE key = 'offers_v3'`).get()) {
    db.transaction(() => {
      const keep = new Set(CATALOG_IDS);
      const all = db.prepare(`SELECT id FROM offers`).all() as Array<{ id: string }>;
      for (const { id } of all) {
        if (keep.has(id)) continue;
        const used = db.prepare(`SELECT 1 FROM bookings WHERE offer_id = ? UNION SELECT 1 FROM slots WHERE offer_id = ?`).get(id, id);
        if (used) db.prepare(`UPDATE offers SET active = 0, sort = 999 WHERE id = ?`).run(id);
        else db.prepare(`DELETE FROM offers WHERE id = ?`).run(id);
      }
      for (const c of CATALOG) c.ids.forEach((id, i) => {
        db.prepare(`UPDATE offers SET title = ?, description = ? WHERE id = ?`)
          .run(c.ids.length > 1 ? `${c.title} – ${i === 0 ? "Fahrschule" : "TÜV-Gebühr"}` : c.title, i === 0 ? c.defaults.description : "", id);
      });
      db.prepare(`INSERT INTO settings (key,value) VALUES ('offers_v3','1')`).run();
    })();
  }
}
