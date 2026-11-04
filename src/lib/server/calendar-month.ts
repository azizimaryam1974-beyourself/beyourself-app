import type Database from "better-sqlite3";
import { addDays, berlinToMs, dayKey } from "../time";
import { closedReason, sunsetMs } from "../calendar";
import { listSlotsBetween, type Booking } from "./booking";
import { freeIntervals, listBlocks, mainTeacherId, STRIKE_NOTE } from "./drive-booking";
import { getDetails, addressLine } from "./user-details";
import { fullAddress } from "../school";

/** Ein Eintrag in der Tagesliste des Kalenders. */
export type DayEntry =
  | { type: "drive"; id: string; start: number; end: number; b: Booking }
  | { type: "private"; id: string; start: number; end: number; note: string }
  | { type: "free"; id: string; start: number; end: number };

export interface MonthCell { day: string; inMonth: boolean; closed: string | null; count: number; kinds: string[]; today: boolean }

const ACTIVE = ["requested", "awaiting_payment", "paid"];

/** Monatsraster Mo–So (6 Wochen) mit Anzahl Termine je Tag. */
export function monthGrid(db: Database.Database, month: string, now = Date.now()): MonthCell[] {
  const first = `${month}-01`;
  const wd = (new Date(`${first}T12:00:00Z`).getUTCDay() + 6) % 7; // 0 = Montag
  const start = addDays(first, -wd);
  const from = berlinToMs(start, "00:00"), to = berlinToMs(addDays(start, 42), "00:00");
  const counts = new Map<string, { n: number; kinds: string[] }>();
  for (const s of listSlotsBetween(db, from, to)) {
    const b = s.bookings.find((x) => ACTIVE.includes(x.status));
    if (!b) continue;
    const k = dayKey(s.startsAt);
    const c = counts.get(k) ?? { n: 0, kinds: [] };
    c.n++; if (b.kind) c.kinds.push(b.kind); counts.set(k, c);
  }
  const today = dayKey(now);
  return Array.from({ length: 42 }, (_, i) => {
    const day = addDays(start, i);
    return { day, inMonth: day.startsWith(month), closed: closedReason(day), count: counts.get(day)?.n ?? 0, kinds: counts.get(day)?.kinds ?? [], today: day === today };
  });
}

/** Alles an einem Tag in zeitlicher Reihenfolge: Fahrten/Prüfungen, private Termine, freie Lücken (ab 45 Min). */
export function dayEntries(db: Database.Database, day: string, now = Date.now()): { entries: DayEntry[]; sunset: number } {
  const from = berlinToMs(day, "00:00"), to = berlinToMs(addDays(day, 1), "00:00");
  const out: DayEntry[] = [];
  for (const s of listSlotsBetween(db, from, to)) {
    const b = s.bookings.find((x) => ACTIVE.includes(x.status));
    if (b && (s.status === "reserved" || s.status === "booked")) out.push({ type: "drive", id: b.id, start: s.startsAt, end: s.endsAt, b });
  }
  for (const bl of listBlocks(db, from, to)) {
    if (bl.note === STRIKE_NOTE) continue;
    out.push({ type: "private", id: bl.id, start: Math.max(bl.startsAt, from), end: Math.min(bl.endsAt, to), note: bl.note || "Privater Termin" });
  }
  const teacher = mainTeacherId(db);
  if (teacher && !closedReason(day)) {
    for (const iv of freeIntervals(db, teacher, day, undefined, now)) {
      const s = Math.max(iv.start, now);
      if (iv.end - s >= 45 * 60_000) out.push({ type: "free", id: `free-${s}`, start: s, end: iv.end });
    }
  }
  out.sort((a, b) => a.start - b.start);
  return { entries: out, sunset: sunsetMs(day) };
}

/** Wohin fahren? Treffpunkt → Adresse für die Navigation. */
export function destinationFor(db: Database.Database, b: Booking): { label: string; address: string } {
  const mp = b.meetingPoint || "";
  if (/^Fahrschule/.test(mp)) return { label: "Fahrschule", address: fullAddress };
  if (/^TÜV/.test(mp)) return { label: "TÜV Kassel", address: "TÜV Hessen, Kassel" };
  // Abholung: erst Adresse aus der Notiz (wenn sie nach Adresse aussieht), sonst die gespeicherte Adresse des Schülers
  const note = (b.studentNote || "").trim();
  if (/\d/.test(note) && note.length >= 6) return { label: "Abholung", address: note };
  const a = addressLine(getDetails(db, b.userId));
  return { label: "Abholung", address: a || mp };
}
