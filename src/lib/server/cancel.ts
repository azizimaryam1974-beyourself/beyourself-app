import type Database from "better-sqlite3";
import { addDays, berlinToMs, dayKey } from "../time";
import { BookingError, getBooking, getSettings, type Booking, type Settings } from "./booking";
import { addCredit, releaseHold, removeCredit } from "./credit";

/**
 * Absage-Regeln für Fahrten (Entscheidungen von Maryam, 31.10.2026):
 * - Kostenlos absagen (alles als Guthaben) bis 24 Std. vorher, spätestens 21 Uhr am Vortag – das Frühere gilt.
 * - Wer weniger als 24 Std. vorher bucht (Last-Minute), kann nicht mehr absagen.
 * - Späte Absage: 70 % werden berechnet, 30 % als Guthaben. Wird der Termin neu besetzt, gibt es alles zurück.
 * - Nicht erschienen oder > 15 Min zu spät: 75 % werden berechnet, 25 % als Guthaben.
 * - Geld wird nicht zurückgezahlt, sondern gutgeschrieben (Auszahlung nur durch die Fahrschule).
 */

export type CancelMode = "withdraw" | "free" | "late" | "lastminute" | "past";

export interface CancelInfo { mode: CancelMode; deadline: number | null; chargeCents: number; creditCents: number }

/** Frist für die kostenlose Absage: 24 Std. vorher, spätestens um 21 Uhr am Vortag. */
export function freeCancelDeadline(start: number, s: Pick<Settings, "freeCancelHours" | "cancelCutoffHour">): number {
  const byHours = start - s.freeCancelHours * 3_600_000;
  const cutoff = berlinToMs(addDays(dayKey(start), -1), `${String(s.cancelCutoffHour).padStart(2, "0")}:00`);
  return Math.min(byHours, cutoff);
}

export function cancelInfo(b: Pick<Booking, "status" | "startsAt" | "createdAt" | "priceCents">, s: Settings, now = Date.now()): CancelInfo {
  if (b.status === "requested" || b.status === "awaiting_payment") return { mode: "withdraw", deadline: null, chargeCents: 0, creditCents: 0 };
  if (b.status !== "paid" || !b.startsAt) return { mode: "past", deadline: null, chargeCents: 0, creditCents: 0 };
  if (now >= b.startsAt) return { mode: "past", deadline: null, chargeCents: 0, creditCents: 0 };
  const deadline = freeCancelDeadline(b.startsAt, s);
  // Last-Minute: gebucht, als die kostenlose Frist schon vorbei war
  if (b.createdAt >= deadline) return { mode: "lastminute", deadline, chargeCents: b.priceCents, creditCents: 0 };
  if (now < deadline) return { mode: "free", deadline, chargeCents: 0, creditCents: b.priceCents };
  const charge = Math.round((b.priceCents * s.lateChargePct) / 100);
  return { mode: "late", deadline, chargeCents: charge, creditCents: b.priceCents - charge };
}

export interface CancelOutcome { booking: Booking; info: CancelInfo; freed: { start: number; end: number } | null }

/** Schüler sagt eine Fahrt ab (oder zieht eine Anfrage / offene Zahlung zurück). */
export function cancelDriveByStudent(db: Database.Database, userId: string, bookingId: string, now = Date.now()): CancelOutcome {
  return db.transaction(() => {
    const b = getBooking(db, bookingId);
    if (!b || b.userId !== userId) throw new BookingError("Buchung nicht gefunden.");
    if (b.examId) throw new BookingError("Prüfungstermine legt die Fahrschule fest. Bitte melde dich dort, wenn etwas nicht passt.");
    const info = cancelInfo(b, getSettings(db), now);
    if (info.mode === "lastminute") throw new BookingError("Das ist ein Last-Minute-Termin (weniger als 24 Stunden vorher gebucht) – er kann nicht mehr abgesagt werden.");
    if (info.mode === "past") throw new BookingError("Diese Fahrt kann nicht mehr abgesagt werden.");
    const freed = b.startsAt && b.endsAt ? { start: b.startsAt, end: b.endsAt } : null;
    if (info.mode === "withdraw") {
      db.prepare(`UPDATE bookings SET status = 'withdrawn', cancelled_at = ?, cancelled_by = 'student' WHERE id = ?`).run(now, b.id);
      releaseHold(db, b.id, now);
    } else {
      db.prepare(`UPDATE bookings SET status = 'cancelled', cancelled_at = ?, cancelled_by = 'student', charge_cents = ?, refund_cents = 0 WHERE id = ?`)
        .run(now, info.chargeCents, b.id);
      addCredit(db, { userId, bookingId: b.id, amountCents: info.creditCents, reason: info.mode === "free" ? "cancel_free" : "cancel_late" }, now);
    }
    if (b.slotId) db.prepare(`UPDATE slots SET status = 'closed' WHERE id = ?`).run(b.slotId);
    return { booking: getBooking(db, b.id)!, info, freed };
  })();
}

/**
 * Neue bezahlte Fahrt überschneidet eine spät abgesagte → der Termin wurde neu besetzt,
 * die Ausfallgebühr geht (anteilig zur Überschneidung) als Guthaben zurück.
 */
export function creditRefills(db: Database.Database, newBooking: Booking, now = Date.now()): Array<{ userId: string; cents: number; bookingId: string }> {
  if (!newBooking.startsAt || !newBooking.endsAt) return [];
  const rows = db.prepare(
    `SELECT b.id, b.user_id, b.charge_cents, s.starts_at, s.ends_at FROM bookings b JOIN slots s ON s.id = b.slot_id
     WHERE b.status = 'cancelled' AND b.cancelled_by = 'student' AND b.charge_cents > 0 AND b.refill_credited = 0
       AND b.user_id != ? AND s.starts_at < ? AND s.ends_at > ?`,
  ).all(newBooking.userId, newBooking.endsAt, newBooking.startsAt) as Array<{ id: string; user_id: string; charge_cents: number; starts_at: number; ends_at: number }>;
  const out: Array<{ userId: string; cents: number; bookingId: string }> = [];
  for (const r of rows) {
    const overlap = Math.min(r.ends_at, newBooking.endsAt) - Math.max(r.starts_at, newBooking.startsAt);
    const cents = Math.round((r.charge_cents * overlap) / (r.ends_at - r.starts_at));
    if (cents <= 0) continue;
    addCredit(db, { userId: r.user_id, bookingId: r.id, amountCents: cents, reason: "refill" }, now);
    db.prepare(`UPDATE bookings SET refill_credited = 1, charge_cents = charge_cents - ? WHERE id = ?`).run(cents, r.id);
    out.push({ userId: r.user_id, cents, bookingId: r.id });
  }
  return out;
}

/** Fahrlehrer markiert „nicht erschienen“ / „zu spät“ (oder nimmt es zurück). */
export function applyNoShow(db: Database.Database, bookingId: string, noShow: boolean, now = Date.now()): number {
  const b = getBooking(db, bookingId);
  if (!b || b.status !== "paid") return 0;
  if (!noShow) {
    removeCredit(db, b.id, "no_show");
    db.prepare(`UPDATE bookings SET charge_cents = 0 WHERE id = ?`).run(b.id);
    return 0;
  }
  const charge = Math.round((b.priceCents * getSettings(db).noShowChargePct) / 100);
  addCredit(db, { userId: b.userId, bookingId: b.id, amountCents: b.priceCents - charge, reason: "no_show" }, now);
  db.prepare(`UPDATE bookings SET charge_cents = ? WHERE id = ?`).run(charge, b.id);
  return b.priceCents - charge;
}

/** Fahrschule sagt ab: Betrag als Guthaben (Standard) – optional echtes Geld zurück (separat über Zahlungsanbieter). */
export function schoolCancelCredit(db: Database.Database, b: Booking, asMoney: boolean, now = Date.now()): { creditCents: number; moneyCents: number } {
  if (b.status !== "cancelled" || b.cancelledBy !== "school") return { creditCents: 0, moneyCents: 0 };
  const paidMoney = b.priceCents - b.creditCents;
  const credit = asMoney ? b.creditCents : b.priceCents;
  addCredit(db, { userId: b.userId, bookingId: b.id, amountCents: credit, reason: "school_cancel" }, now);
  return { creditCents: credit, moneyCents: asMoney ? paidMoney : 0 };
}

