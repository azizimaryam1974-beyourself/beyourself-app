import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { addDays, berlinToMs, dayKey, isDayKey, mondayOf } from "../time";
import { BookingError } from "./booking";

/**
 * Warteliste (Entscheidungen von Maryam, 31.10.2026):
 * - Schüler tragen sich für einen Tag + Zeitraum ein – höchstens 1 Eintrag pro Kalenderwoche.
 * - Wird eine Zeit frei, bekommt nur Platz 1 die Nachricht; die Zeit ist 30 Min für alle anderen unsichtbar.
 * - Danach ist sie für alle buchbar und alle übrigen auf der Warteliste werden benachrichtigt.
 * - Nachtruhe 22–7 Uhr: die Nachricht kommt um 7 Uhr, erst dann laufen die 30 Minuten.
 * - Die Exklusivzeit gilt immer (endet spätestens mit Beginn der Fahrt).
 */

export const HOLD_MIN = 30;
export interface WaitEntry { id: string; userId: string; day: string; fromMin: number; toMin: number; createdAt: number }
export interface Hold { id: string; userId: string; startsAt: number; endsAt: number; notifyAt: number; expiresAt: number; notified: boolean }

type Row = Record<string, unknown>;
const mapEntry = (r: Row): WaitEntry => ({ id: r.id as string, userId: r.user_id as string, day: r.day as string, fromMin: r.from_min as number, toMin: r.to_min as number, createdAt: r.created_at as number });
const mapHold = (r: Row): Hold => ({ id: r.id as string, userId: r.user_id as string, startsAt: r.starts_at as number, endsAt: r.ends_at as number, notifyAt: r.notify_at as number, expiresAt: r.expires_at as number, notified: !!r.notified });

/** Nächster erlaubter Zeitpunkt für eine Nachricht (Nachtruhe 22–7 Uhr). */
export function notifyTime(now: number): number {
  const h = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Berlin", hour: "2-digit", hourCycle: "h23" }).format(now));
  if (h >= 22) return berlinToMs(addDays(dayKey(now), 1), "07:00");
  if (h < 7) return berlinToMs(dayKey(now), "07:00");
  return now;
}

export function listWaitlist(db: Database.Database, userId: string, today: string): WaitEntry[] {
  return (db.prepare(`SELECT * FROM waitlist WHERE user_id = ? AND day >= ? ORDER BY day`).all(userId, today) as Row[]).map(mapEntry);
}

export function addWaitlist(db: Database.Database, userId: string, day: string, fromMin: number, toMin: number, now = Date.now()): WaitEntry {
  if (!isDayKey(day) || day < dayKey(now)) throw new BookingError("Bitte einen Tag ab heute wählen.");
  if (!(toMin - fromMin >= 60)) throw new BookingError("Der Zeitraum muss mindestens 60 Minuten lang sein.");
  const mon = mondayOf(day), sun = addDays(mon, 6);
  const same = db.prepare(`SELECT 1 FROM waitlist WHERE user_id = ? AND day BETWEEN ? AND ?`).get(userId, mon, sun);
  if (same) throw new BookingError("Du stehst in dieser Woche schon auf der Warteliste. Pro Woche ist ein Eintrag möglich.");
  const e = { id: randomUUID(), userId, day, fromMin, toMin, createdAt: now };
  db.prepare(`INSERT INTO waitlist (id,user_id,day,from_min,to_min,created_at) VALUES (?,?,?,?,?,?)`).run(e.id, userId, day, fromMin, toMin, now);
  return e;
}

export function removeWaitlist(db: Database.Database, userId: string, id: string): void {
  db.prepare(`DELETE FROM waitlist WHERE id = ? AND user_id = ?`).run(id, userId);
}

/** Wartende für eine frei gewordene Zeit, in Reihenfolge der Eintragung. */
export function waitersFor(db: Database.Database, start: number, end: number, exceptUser?: string): WaitEntry[] {
  const day = dayKey(start);
  const sMin = Math.round((start - berlinToMs(day, "00:00")) / 60_000), eMin = Math.round((end - berlinToMs(day, "00:00")) / 60_000);
  return (db.prepare(`SELECT * FROM waitlist WHERE day = ? AND from_min < ? AND to_min > ? ORDER BY created_at`).all(day, eMin, sMin) as Row[])
    .map(mapEntry).filter((e) => e.userId !== exceptUser);
}

/** Exklusiv-Reservierung für Platz 1 anlegen. */
export function createHold(db: Database.Database, userId: string, start: number, end: number, now = Date.now()): Hold {
  const notifyAt = notifyTime(now);
  const h: Hold = { id: randomUUID(), userId, startsAt: start, endsAt: end, notifyAt, expiresAt: Math.min(notifyAt + HOLD_MIN * 60_000, start), notified: false };
  db.prepare(`INSERT INTO waitlist_holds (id,user_id,starts_at,ends_at,notify_at,expires_at,notified,created_at) VALUES (?,?,?,?,?,?,0,?)`)
    .run(h.id, userId, start, end, h.notifyAt, h.expiresAt, now);
  return h;
}

/** Aktive Reservierungen im Zeitraum (für die Verfügbarkeit). */
export function activeHolds(db: Database.Database, from: number, to: number, now = Date.now()): Hold[] {
  return (db.prepare(`SELECT * FROM waitlist_holds WHERE expires_at > ? AND ends_at > ? AND starts_at < ?`).all(now, from, to) as Row[]).map(mapHold);
}

export function dueHoldNotifications(db: Database.Database, now = Date.now()): Hold[] {
  const list = (db.prepare(`SELECT * FROM waitlist_holds WHERE notified = 0 AND notify_at <= ? AND expires_at > ?`).all(now, now) as Row[]).map(mapHold);
  for (const h of list) db.prepare(`UPDATE waitlist_holds SET notified = 1 WHERE id = ?`).run(h.id);
  return list;
}

/** Abgelaufene Reservierungen entfernen und zurückgeben (danach: alle anderen benachrichtigen). */
export function takeExpiredHolds(db: Database.Database, now = Date.now()): Hold[] {
  const list = (db.prepare(`SELECT * FROM waitlist_holds WHERE expires_at <= ?`).all(now) as Row[]).map(mapHold);
  for (const h of list) db.prepare(`DELETE FROM waitlist_holds WHERE id = ?`).run(h.id);
  return list;
}

/** Hat jemand mit Reservierung gebucht → Reservierung erledigt. */
export function clearHoldsOf(db: Database.Database, userId: string, start: number, end: number): void {
  db.prepare(`DELETE FROM waitlist_holds WHERE user_id = ? AND starts_at < ? AND ends_at > ?`).run(userId, end, start);
}

export function purgeOldWaitlist(db: Database.Database, now = Date.now()): void {
  db.prepare(`DELETE FROM waitlist WHERE day < ?`).run(dayKey(now));
}
