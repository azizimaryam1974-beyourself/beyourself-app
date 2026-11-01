import type Database from "better-sqlite3";

/**
 * Persönliche Angaben + Profilfoto (Pflicht für Schüler: Geburtstag, Adresse, Telefon, E-Mail).
 * Eigene Tabelle, damit die Benutzer-Tabelle unverändert bleibt.
 */
export const DETAILS_SCHEMA = `
CREATE TABLE IF NOT EXISTS user_details (
  user_id     TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  birthday    TEXT,
  street      TEXT NOT NULL DEFAULT '',
  zip         TEXT NOT NULL DEFAULT '',
  city        TEXT NOT NULL DEFAULT '',
  photo_path  TEXT,
  photo_at    INTEGER,
  updated_at  INTEGER NOT NULL
);
`;

export interface Details { birthday: string | null; street: string; zip: string; city: string; photoPath: string | null; photoAt: number | null }
const EMPTY: Details = { birthday: null, street: "", zip: "", city: "", photoPath: null, photoAt: null };

export function getDetails(db: Database.Database, userId: string): Details {
  const r = db.prepare(`SELECT * FROM user_details WHERE user_id = ?`).get(userId) as Record<string, unknown> | undefined;
  if (!r) return { ...EMPTY };
  return { birthday: (r.birthday as string) ?? null, street: r.street as string, zip: r.zip as string, city: r.city as string,
    photoPath: (r.photo_path as string) ?? null, photoAt: r.photo_at == null ? null : Number(r.photo_at) };
}

export function detailsMap(db: Database.Database): Map<string, Details> {
  const rows = db.prepare(`SELECT * FROM user_details`).all() as Array<Record<string, unknown>>;
  return new Map(rows.map((r) => [r.user_id as string, { birthday: (r.birthday as string) ?? null, street: r.street as string, zip: r.zip as string, city: r.city as string,
    photoPath: (r.photo_path as string) ?? null, photoAt: r.photo_at == null ? null : Number(r.photo_at) }]));
}

export interface DetailsInput { birthday: string; street: string; zip: string; city: string; phone: string }
export type DetailsErrors = Partial<Record<keyof DetailsInput, string>>;

/** Prüft die Pflichtangaben. Gibt Fehlermeldungen je Feld zurück (leer = alles gut). */
export function validateDetails(d: DetailsInput, now = Date.now()): DetailsErrors {
  const e: DetailsErrors = {};
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d.birthday);
  const t = m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : NaN;
  const age = (now - t) / (365.25 * 86_400_000);
  if (!m || Number.isNaN(t) || age < 14 || age > 100) e.birthday = "Bitte dein Geburtsdatum eingeben.";
  if (d.street.trim().length < 3 || !/\d/.test(d.street)) e.street = "Bitte Straße und Hausnummer eingeben.";
  if (!/^\d{5}$/.test(d.zip.trim())) e.zip = "Bitte eine 5-stellige Postleitzahl.";
  if (d.city.trim().length < 2) e.city = "Bitte den Ort eingeben.";
  if (d.phone.replace(/[^\d]/g, "").length < 6) e.phone = "Bitte eine Telefonnummer eingeben.";
  return e;
}

export function saveDetails(db: Database.Database, userId: string, d: Omit<DetailsInput, "phone">, now = Date.now()): void {
  db.prepare(`INSERT INTO user_details (user_id, birthday, street, zip, city, updated_at) VALUES (?,?,?,?,?,?)
    ON CONFLICT(user_id) DO UPDATE SET birthday = excluded.birthday, street = excluded.street, zip = excluded.zip, city = excluded.city, updated_at = excluded.updated_at`)
    .run(userId, d.birthday, d.street.trim().slice(0, 120), d.zip.trim().slice(0, 10), d.city.trim().slice(0, 80), now);
}

export function setPhone(db: Database.Database, userId: string, phone: string): void {
  db.prepare(`UPDATE users SET phone = ? WHERE id = ?`).run(phone.trim().slice(0, 40) || null, userId);
}

export function setPhoto(db: Database.Database, userId: string, path: string | null, now = Date.now()): string | null {
  const old = getDetails(db, userId).photoPath;
  db.prepare(`INSERT INTO user_details (user_id, photo_path, photo_at, updated_at) VALUES (?,?,?,?)
    ON CONFLICT(user_id) DO UPDATE SET photo_path = excluded.photo_path, photo_at = excluded.photo_at, updated_at = excluded.updated_at`)
    .run(userId, path, path ? now : null, now);
  return old;
}

/** Fehlen Pflichtangaben? (Schüler) */
export function detailsMissing(db: Database.Database, user: { id: string; phone: string | null }): boolean {
  const d = getDetails(db, user.id);
  return Object.keys(validateDetails({ birthday: d.birthday ?? "", street: d.street, zip: d.zip, city: d.city, phone: user.phone ?? "" })).length > 0;
}

export const addressLine = (d: Details) => [d.street, [d.zip, d.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");

/** Geburtstage heute und in den nächsten `days` Tagen (Berliner Datum). */
export function upcomingBirthdays(db: Database.Database, today: string, days = 7): Array<{ userId: string; name: string; date: string; inDays: number; age: number }> {
  const rows = db.prepare(`SELECT u.id, u.name, d.birthday FROM users u JOIN user_details d ON d.user_id = u.id WHERE u.role = 'student' AND d.birthday IS NOT NULL`).all() as Array<{ id: string; name: string; birthday: string }>;
  const [ty, tm, td] = today.split("-").map(Number);
  const t0 = Date.UTC(ty, tm - 1, td);
  const out: Array<{ userId: string; name: string; date: string; inDays: number; age: number }> = [];
  for (const r of rows) {
    const [by, bm, bd] = r.birthday.split("-").map(Number);
    let next = Date.UTC(ty, bm - 1, bd);
    let year = ty;
    if (next < t0) { next = Date.UTC(ty + 1, bm - 1, bd); year = ty + 1; }
    const inDays = Math.round((next - t0) / 86_400_000);
    if (inDays <= days) out.push({ userId: r.id, name: r.name, date: `${String(bd).padStart(2, "0")}.${String(bm).padStart(2, "0")}.`, inDays, age: year - by });
  }
  return out.sort((a, b) => a.inDays - b.inDays);
}
