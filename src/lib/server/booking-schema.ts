import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";

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

CREATE TABLE IF NOT EXISTS payment_events (
  id TEXT PRIMARY KEY,
  at INTEGER NOT NULL
);
`;

const DEFAULT_OFFERS: Array<[string, string, string, number, number, number]> = [
  // kind, title, description, minutes, needs_approval, active
  ["slot", "Übungsfahrt", "Normale Fahrstunde (45 Minuten).", 45, 1, 1],
  ["slot", "Doppelstunde", "Zwei Fahrstunden am Stück (90 Minuten).", 90, 1, 1],
  ["slot", "Sonderfahrt Überland", "Pflicht-Sonderfahrt außerhalb geschlossener Ortschaften.", 45, 1, 1],
  ["slot", "Sonderfahrt Autobahn", "Pflicht-Sonderfahrt auf der Autobahn.", 45, 1, 1],
  ["slot", "Sonderfahrt Nacht", "Pflicht-Sonderfahrt bei Dunkelheit.", 45, 1, 1],
  ["slot", "Praktische Prüfung", "Vorstellung zur praktischen Prüfung.", 60, 1, 1],
  ["product", "Grundbetrag Klasse B", "Anmeldung, Theorieunterricht und Verwaltung für Klasse B.", 0, 0, 0],
  ["product", "Grundbetrag Klasse B197", "Anmeldung, Theorieunterricht und Verwaltung für Klasse B197.", 0, 0, 0],
  ["product", "Grundbetrag Klasse B78", "Anmeldung, Theorieunterricht und Verwaltung für Klasse B78.", 0, 0, 0],
  ["product", "Lernmaterial / Lern-App", "Zugang zur Lern-App für die Theorieprüfung.", 0, 0, 0],
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

export function seedBookingDefaults(db: Database.Database): void {
  migrate(db);
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
}
