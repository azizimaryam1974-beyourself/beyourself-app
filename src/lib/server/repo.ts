import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import {
  LANGUAGE_PACKAGE_PRICE_CENTS,
  type LanguagePackage,
  type LanguagePackageStatus,
} from "../language-package";
import type { TargetLanguageCode } from "../languages";
import type { StoredSegment } from "../live-hub";
import type { Translations } from "../translation/types";

export const SCHOOL_ID = "beyourself";

export type Role = "student" | "teacher";

export interface User {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: Role;
  created_at: string;
}

interface UserRow extends User {
  password_hash: string;
}

const nowIso = () => new Date().toISOString();

// ---------- Benutzer ----------------------------------------------------------

export function createUser(
  db: Database.Database,
  u: { email: string; name: string; phone?: string | null; passwordHash: string; role: Role },
): User {
  const user: UserRow = {
    id: randomUUID(),
    email: u.email.trim().toLowerCase(),
    name: u.name.trim(),
    phone: u.phone?.trim() || null,
    password_hash: u.passwordHash,
    role: u.role,
    created_at: nowIso(),
  };
  db.prepare(
    `INSERT INTO users (id,email,name,phone,password_hash,role,created_at)
     VALUES (@id,@email,@name,@phone,@password_hash,@role,@created_at)`,
  ).run(user);
  const { password_hash: _, ...pub } = user;
  return pub;
}

export function findUserByEmail(db: Database.Database, email: string): UserRow | undefined {
  return db.prepare(`SELECT * FROM users WHERE email = ?`).get(email.trim().toLowerCase()) as UserRow | undefined;
}

export function getUser(db: Database.Database, id: string): User | undefined {
  return db
    .prepare(`SELECT id,email,name,phone,role,created_at FROM users WHERE id = ?`)
    .get(id) as User | undefined;
}

export function setUserPassword(db: Database.Database, id: string, passwordHash: string): void {
  db.prepare(`UPDATE users SET password_hash = ? WHERE id = ?`).run(passwordHash, id);
}

export function setUserRole(db: Database.Database, id: string, role: Role): void {
  db.prepare(`UPDATE users SET role = ? WHERE id = ?`).run(role, id);
}

// ---------- Login-Sitzungen --------------------------------------------------

export function insertAuthSession(db: Database.Database, tokenHash: string, userId: string, expiresAt: number) {
  db.prepare(`INSERT INTO auth_sessions (token_hash,user_id,expires_at) VALUES (?,?,?)`).run(tokenHash, userId, expiresAt);
}

export function userForSession(db: Database.Database, tokenHash: string): User | undefined {
  return db
    .prepare(
      `SELECT u.id,u.email,u.name,u.phone,u.role,u.created_at
       FROM auth_sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.expires_at > ?`,
    )
    .get(tokenHash, Date.now()) as User | undefined;
}

export function deleteAuthSession(db: Database.Database, tokenHash: string) {
  db.prepare(`DELETE FROM auth_sessions WHERE token_hash = ?`).run(tokenHash);
}

export function purgeExpiredSessions(db: Database.Database) {
  db.prepare(`DELETE FROM auth_sessions WHERE expires_at <= ?`).run(Date.now());
}

// ---------- Sprachpakete -----------------------------------------------------

export interface PackageRow extends LanguagePackage {
  paidAt: string | null;
  cancelledAt: string | null;
}

function mapPkg(r: Record<string, unknown> | undefined): PackageRow | null {
  if (!r) return null;
  return {
    id: r.id as string,
    userId: r.user_id as string,
    schoolId: r.school_id as string,
    language: r.language as TargetLanguageCode,
    priceCents: r.price_cents as number,
    status: r.status as LanguagePackageStatus,
    bookedAt: r.booked_at as string,
    paidAt: (r.paid_at as string) ?? null,
    cancelledAt: (r.cancelled_at as string) ?? null,
  };
}

/** Aktuelles (nicht storniertes) Paket, sonst das zuletzt stornierte. */
export function currentPackage(db: Database.Database, userId: string): PackageRow | null {
  return mapPkg(
    db
      .prepare(
        `SELECT * FROM language_packages WHERE user_id = ?
         ORDER BY (status = 'cancelled') ASC, booked_at DESC LIMIT 1`,
      )
      .get(userId) as Record<string, unknown> | undefined,
  );
}

export class PackageAlreadyBookedError extends Error {
  constructor() {
    super("Für dieses Konto ist bereits ein Sprachpaket gebucht.");
  }
}

export function bookPackage(db: Database.Database, userId: string, language: TargetLanguageCode): PackageRow {
  const existing = currentPackage(db, userId);
  if (existing && existing.status !== "cancelled") throw new PackageAlreadyBookedError();
  const at = nowIso();
  const id = randomUUID();
  db.prepare(
    `INSERT INTO language_packages
       (id,user_id,school_id,language,price_cents,status,booked_at,terms_accepted_at)
     VALUES (?,?,?,?,?, 'booked', ?, ?)`,
  ).run(id, userId, SCHOOL_ID, language, LANGUAGE_PACKAGE_PRICE_CENTS, at, at);
  return currentPackage(db, userId)!;
}

export function setPackageStatus(db: Database.Database, packageId: string, status: LanguagePackageStatus) {
  const at = nowIso();
  if (status === "paid") {
    db.prepare(`UPDATE language_packages SET status='paid', paid_at=?, cancelled_at=NULL WHERE id=?`).run(at, packageId);
  } else if (status === "cancelled") {
    db.prepare(`UPDATE language_packages SET status='cancelled', cancelled_at=? WHERE id=?`).run(at, packageId);
  } else {
    db.prepare(`UPDATE language_packages SET status='booked', paid_at=NULL, cancelled_at=NULL WHERE id=?`).run(packageId);
  }
}

export function setPackageLanguage(db: Database.Database, packageId: string, language: TargetLanguageCode) {
  db.prepare(`UPDATE language_packages SET language=? WHERE id=?`).run(language, packageId);
}

export interface StudentOverview extends User {
  pkg: PackageRow | null;
}

export function listStudents(db: Database.Database): StudentOverview[] {
  const users = db
    .prepare(`SELECT id,email,name,phone,role,created_at FROM users WHERE role='student' AND password_hash <> 'deleted' ORDER BY created_at DESC`)
    .all() as User[];
  return users.map((u) => ({ ...u, pkg: currentPackage(db, u.id) }));
}

// ---------- Theoriestunden ---------------------------------------------------

export type LessonStatus = "planned" | "live" | "ended";

export interface Lesson {
  id: string;
  title: string;
  status: LessonStatus;
  created_by: string;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
  /** geplanter Beginn (ms), null = spontane Stunde */
  scheduled_at?: number | null;
  duration_min?: number;
  place?: string;
}

export function createLesson(db: Database.Database, title: string, createdBy: string): Lesson {
  const l: Lesson = {
    id: randomUUID(),
    title: title.trim() || "Theoriestunde",
    status: "planned",
    created_by: createdBy,
    created_at: nowIso(),
    started_at: null,
    ended_at: null,
  };
  db.prepare(
    `INSERT INTO lessons (id,title,status,created_by,created_at,started_at,ended_at)
     VALUES (@id,@title,@status,@created_by,@created_at,@started_at,@ended_at)`,
  ).run(l);
  return l;
}

export function getLesson(db: Database.Database, id: string): Lesson | undefined {
  return db.prepare(`SELECT * FROM lessons WHERE id = ?`).get(id) as Lesson | undefined;
}

export function listLessons(db: Database.Database, limit = 30): Lesson[] {
  return db
    .prepare(`SELECT * FROM lessons ORDER BY (status='live') DESC, created_at DESC LIMIT ?`)
    .all(limit) as Lesson[];
}

/**
 * Vergessene Live-Stunden automatisch beenden: läuft seit mehr als 3 Stunden und
 * seit 30 Minuten wurde nichts mehr gesprochen. Gibt die beendeten IDs zurück.
 */
export function endStaleLessons(db: Database.Database, now = Date.now()): string[] {
  const live = db.prepare(`SELECT id, started_at FROM lessons WHERE status = 'live'`).all() as Array<{ id: string; started_at: string | null }>;
  const ended: string[] = [];
  for (const l of live) {
    const started = l.started_at ? Date.parse(l.started_at) : 0;
    if (now - started < 3 * 3_600_000) continue;
    const last = db.prepare(`SELECT MAX(at) AS at FROM lesson_segments WHERE lesson_id = ?`).get(l.id) as { at: string | null };
    if (last.at && now - Date.parse(last.at) < 30 * 60_000) continue;
    db.prepare(`UPDATE lessons SET status='ended', ended_at=? WHERE id=?`).run(new Date(now).toISOString(), l.id);
    ended.push(l.id);
  }
  return ended;
}

export function setLessonStatus(db: Database.Database, id: string, status: LessonStatus) {
  if (status === "live") {
    db.prepare(`UPDATE lessons SET status='live', started_at=COALESCE(started_at, ?), ended_at=NULL WHERE id=?`).run(nowIso(), id);
  } else if (status === "ended") {
    db.prepare(`UPDATE lessons SET status='ended', ended_at=? WHERE id=?`).run(nowIso(), id);
  } else {
    db.prepare(`UPDATE lessons SET status='planned' WHERE id=?`).run(id);
  }
}

export function lastSeq(db: Database.Database, lessonId: string): number {
  const r = db.prepare(`SELECT MAX(seq) AS m FROM lesson_segments WHERE lesson_id = ?`).get(lessonId) as { m: number | null };
  return r.m ?? 0;
}

export function saveSegment(db: Database.Database, s: StoredSegment) {
  db.prepare(
    `INSERT OR REPLACE INTO lesson_segments (lesson_id,seq,original,translations,at) VALUES (?,?,?,?,?)`,
  ).run(s.sessionId, s.seq, s.original, JSON.stringify(s.translations), s.at);
}

export function listSegments(db: Database.Database, lessonId: string): StoredSegment[] {
  const rows = db
    .prepare(`SELECT * FROM lesson_segments WHERE lesson_id = ? ORDER BY seq ASC`)
    .all(lessonId) as { lesson_id: string; seq: number; original: string; translations: string; at: string }[];
  return rows.map((r) => ({
    sessionId: r.lesson_id,
    seq: r.seq,
    original: r.original,
    translations: JSON.parse(r.translations) as Translations,
    at: r.at,
  }));
}

// ---------- Passwort zurücksetzen --------------------------------------------

export function createPasswordReset(db: Database.Database, tokenHash: string, userId: string, createdBy: string, ttlMs: number) {
  // Ältere, noch offene Links dieses Kontos ungültig machen
  db.prepare(`UPDATE password_resets SET used_at = ? WHERE user_id = ? AND used_at IS NULL`).run(Date.now(), userId);
  db.prepare(`INSERT INTO password_resets (token_hash,user_id,created_by,expires_at) VALUES (?,?,?,?)`).run(
    tokenHash, userId, createdBy, Date.now() + ttlMs,
  );
}

/** Gültiger, unbenutzter Link → Benutzer, sonst undefined. */
export function userForPasswordReset(db: Database.Database, tokenHash: string): User | undefined {
  return db
    .prepare(
      `SELECT u.id,u.email,u.name,u.phone,u.role,u.created_at
       FROM password_resets r JOIN users u ON u.id = r.user_id
       WHERE r.token_hash = ? AND r.used_at IS NULL AND r.expires_at > ?`,
    )
    .get(tokenHash, Date.now()) as User | undefined;
}

/** Neues Passwort setzen, Link verbrauchen, alle Anmeldungen beenden. */
export function completePasswordReset(db: Database.Database, tokenHash: string, passwordHash: string): User | undefined {
  return db.transaction(() => {
    const user = userForPasswordReset(db, tokenHash);
    if (!user) return undefined;
    db.prepare(`UPDATE password_resets SET used_at = ? WHERE token_hash = ?`).run(Date.now(), tokenHash);
    db.prepare(`UPDATE users SET password_hash = ? WHERE id = ?`).run(passwordHash, user.id);
    db.prepare(`DELETE FROM auth_sessions WHERE user_id = ?`).run(user.id);
    return user;
  })();
}

// ---------- Löschfristen -----------------------------------------------------

/**
 * Löscht die Sätze (Protokolle) aller Stunden, die vor mehr als `days`
 * Tagen beendet wurden. Die Stunde selbst (Titel, Datum) bleibt erhalten.
 */
export function purgeOldSegments(db: Database.Database, days: number, now = Date.now()): number {
  const cutoff = new Date(now - days * 24 * 60 * 60 * 1000).toISOString();
  return db
    .prepare(
      `DELETE FROM lesson_segments WHERE lesson_id IN
         (SELECT id FROM lessons WHERE status = 'ended' AND ended_at IS NOT NULL AND ended_at < ?)`,
    )
    .run(cutoff).changes;
}

// ---------- DSGVO: Auskunft & Löschung ---------------------------------------

export interface PersonalDataExport {
  exportedAt: string;
  account: User;
  languagePackages: PackageRow[];
  bookings: unknown[];
  notifications: unknown[];
  activeSessions: number;
  note: string;
}

export function exportPersonalData(db: Database.Database, userId: string): PersonalDataExport | null {
  const account = getUser(db, userId);
  if (!account) return null;
  const pkgs = (db.prepare(`SELECT * FROM language_packages WHERE user_id = ? ORDER BY booked_at`).all(userId) as Record<string, unknown>[])
    .map((r) => mapPkg(r)!);
  const { n } = db.prepare(`SELECT COUNT(*) AS n FROM auth_sessions WHERE user_id = ? AND expires_at > ?`).get(userId, Date.now()) as { n: number };
  return {
    exportedAt: new Date().toISOString(),
    account,
    languagePackages: pkgs,
    bookings: db.prepare(
      `SELECT b.title, b.price_cents, b.status, b.student_note, b.admin_message, b.created_at, b.paid_at, b.cancelled_at, b.refund_cents, b.provider, s.starts_at
       FROM bookings b LEFT JOIN slots s ON s.id = b.slot_id WHERE b.user_id = ? ORDER BY b.created_at`).all(userId),
    notifications: db.prepare(`SELECT title, body, created_at, read_at FROM notifications WHERE user_id = ? ORDER BY created_at`).all(userId),
    activeSessions: n,
    note:
      "Gespeichert sind diese Kontodaten, Buchungen und Nachrichten. Zahlungsdaten (Karte, PayPal-Konto) liegen nur beim Zahlungsanbieter. Unterrichtsprotokolle enthalten ausschließlich Sätze der Lehrkraft und keine Daten von Schülern.",
  };
}

/**
 * Konto löschen. Personenbezogene Daten werden entfernt; die Buchung des
 * Sprachpakets bleibt anonym erhalten (Aufbewahrungspflicht für Zahlungen).
 */
export function deleteStudent(db: Database.Database, userId: string): boolean {
  return db.transaction(() => {
    const u = getUser(db, userId);
    if (!u || u.role !== "student") return false;
    db.prepare(`DELETE FROM auth_sessions WHERE user_id = ?`).run(userId);
    db.prepare(`DELETE FROM password_resets WHERE user_id = ?`).run(userId);
    // Offene Anfragen zurückziehen (reservierte Termine werden wieder frei), Nachrichten löschen.
    // Bezahlte Buchungen bleiben (Aufbewahrungspflicht), aber ohne Namen und Notizen.
    db.prepare(`UPDATE slots SET status = 'open' WHERE status = 'reserved' AND id IN (SELECT slot_id FROM bookings WHERE user_id = ? AND status = 'awaiting_payment')`).run(userId);
    db.prepare(`UPDATE bookings SET status = 'withdrawn', cancelled_at = ?, cancelled_by = 'student' WHERE user_id = ? AND status IN ('requested','awaiting_payment')`).run(Date.now(), userId);
    db.prepare(`UPDATE bookings SET student_note = '' WHERE user_id = ?`).run(userId);
    db.prepare(`DELETE FROM notifications WHERE user_id = ?`).run(userId);
    db.prepare(
      `UPDATE users SET email = ?, name = 'Gelöschtes Konto', phone = NULL, password_hash = 'deleted' WHERE id = ?`,
    ).run(`geloescht-${userId}@invalid`, userId);
    return true;
  })();
}
