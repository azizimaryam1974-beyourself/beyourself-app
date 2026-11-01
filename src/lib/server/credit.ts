import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";

/**
 * Guthaben-Konto je Schüler. Jede Bewegung ist ein Eintrag (+ Gutschrift, − Verbrauch).
 * Geld wird grundsätzlich nicht zurückgezahlt, sondern gutgeschrieben – Auszahlung nur durch die Fahrschule.
 *
 * Gründe:
 *  hold / hold_release   Guthaben für eine offene Zahlung reserviert / wieder frei (Frist abgelaufen, abgebrochen)
 *  pay                   Buchung komplett mit Guthaben bezahlt
 *  cancel_free           kostenlose Absage (100 %)
 *  cancel_late           späte Absage (Rest nach Ausfallgebühr)
 *  refill                Termin nach später Absage neu besetzt → Ausfallgebühr zurück
 *  no_show               nicht erschienen / zu spät (Rest nach Ausfallgebühr)
 *  school_cancel         Fahrschule hat abgesagt
 *  deposit               Einzahlung (Überweisung oder bar) – Vorauszahlung, zählt als Einnahme
 *  manual / payout       von der Fahrschule gebucht / ausgezahlt
 */
export type CreditReason = "deposit" | "hold" | "hold_release" | "pay" | "cancel_free" | "cancel_late" | "refill" | "no_show" | "school_cancel" | "manual" | "payout";

export interface CreditEntry { id: string; userId: string; bookingId: string | null; amountCents: number; reason: CreditReason; note: string; createdAt: number }

export const CREDIT_LABEL: Record<CreditReason, string> = {
  deposit: "Einzahlung",
  hold: "für Zahlung verwendet", hold_release: "Zahlung nicht abgeschlossen – zurück", pay: "Fahrt mit Guthaben bezahlt",
  cancel_free: "Kostenlose Absage", cancel_late: "Späte Absage (Rest)", refill: "Termin wurde neu besetzt – Ausfallgebühr zurück",
  no_show: "Nicht erschienen / zu spät (Rest)", school_cancel: "Absage durch die Fahrschule", manual: "Gutschrift der Fahrschule", payout: "Ausgezahlt",
};

export function creditBalance(db: Database.Database, userId: string): number {
  return (db.prepare(`SELECT COALESCE(SUM(amount_cents),0) AS s FROM credit_ledger WHERE user_id = ?`).get(userId) as { s: number }).s;
}

export function listCredit(db: Database.Database, userId: string, limit = 50): CreditEntry[] {
  return (db.prepare(`SELECT * FROM credit_ledger WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`).all(userId, limit) as Array<Record<string, unknown>>).map((r) => ({
    id: r.id as string, userId: r.user_id as string, bookingId: (r.booking_id as string) ?? null, amountCents: r.amount_cents as number,
    reason: r.reason as CreditReason, note: r.note as string, createdAt: r.created_at as number,
  }));
}

/** Eintrag anlegen. Pro Buchung und Grund nur einmal (doppelte Aufrufe sind harmlos). */
export function addCredit(db: Database.Database, e: { userId: string; bookingId?: string | null; amountCents: number; reason: CreditReason; note?: string }, now = Date.now()): boolean {
  if (!e.amountCents) return false;
  const r = db.prepare(`INSERT OR IGNORE INTO credit_ledger (id,user_id,booking_id,amount_cents,reason,note,created_at) VALUES (?,?,?,?,?,?,?)`)
    .run(randomUUID(), e.userId, e.bookingId ?? null, Math.round(e.amountCents), e.reason, (e.note ?? "").slice(0, 300), now);
  return r.changes === 1;
}

export function removeCredit(db: Database.Database, bookingId: string, reason: CreditReason): void {
  db.prepare(`DELETE FROM credit_ledger WHERE booking_id = ? AND reason = ?`).run(bookingId, reason);
}

/** Guthaben für eine offene Zahlung reservieren (höchstens so viel wie vorhanden). Gibt die Summe zurück. */
export function holdCredit(db: Database.Database, userId: string, bookingId: string, priceCents: number, now = Date.now()): number {
  return db.transaction(() => {
    const existing = db.prepare(`SELECT credit_cents FROM bookings WHERE id = ?`).get(bookingId) as { credit_cents: number } | undefined;
    const held = db.prepare(`SELECT 1 FROM credit_ledger WHERE booking_id = ? AND reason = 'hold'`).get(bookingId);
    const released = db.prepare(`SELECT 1 FROM credit_ledger WHERE booking_id = ? AND reason = 'hold_release'`).get(bookingId);
    if (held && !released) return existing?.credit_cents ?? 0;
    const use = Math.min(Math.max(0, creditBalance(db, userId)), priceCents);
    if (use > 0 && !held) addCredit(db, { userId, bookingId, amountCents: -use, reason: "hold" }, now);
    db.prepare(`UPDATE bookings SET credit_cents = ? WHERE id = ?`).run(held ? 0 : use, bookingId);
    return held ? 0 : use;
  })();
}

/** Reserviertes Guthaben zurückgeben (Zahlung nicht abgeschlossen). */
export function releaseHold(db: Database.Database, bookingId: string, now = Date.now()): void {
  const h = db.prepare(`SELECT user_id, amount_cents FROM credit_ledger WHERE booking_id = ? AND reason = 'hold'`).get(bookingId) as { user_id: string; amount_cents: number } | undefined;
  if (!h) return;
  addCredit(db, { userId: h.user_id, bookingId, amountCents: -h.amount_cents, reason: "hold_release" }, now);
  db.prepare(`UPDATE bookings SET credit_cents = 0 WHERE id = ?`).run(bookingId);
}
