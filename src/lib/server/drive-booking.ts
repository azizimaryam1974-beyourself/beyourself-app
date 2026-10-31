import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { closedReason, darkStart, startTimes, subtract, workIntervals, type DayRange, type Interval } from "../calendar";
import { addDays, berlinToMs, dayKey, mondayOf } from "../time";
import {
  canBook, computeTraining, DEFAULT_PRICES, KIND_LABEL, priceCents, type DriveKind, type DriveRecord, type PriceConfig, type TrainingState,
} from "../training";
import { BookingError, getBooking, getOffer, getSettings, type Booking } from "./booking";
import { getProfile, listRecords, testfahrtMinutes, type ProfileRow, type StoredRecord } from "./training-repo";
import { activeHolds, clearHoldsOf, createHold, waitersFor, type Hold } from "./waitlist";
import { theoryBusy } from "./theory";

/**
 * Buchen von Fahrten direkt aus den Arbeitszeiten der Fahrschule (keine vorab angelegten Termine mehr).
 * Ablauf: Schüler wählt Art + Länge → freie Startzeiten → Buchung reserviert die Zeit sofort →
 * automatisch bestätigt (30 Min zum Bezahlen) oder – bei „nur mit Freigabe“ – Anfrage an die Fahrschule.
 */

export const MEETING_POINTS = ["Fahrschule, Rudolf-Schwander-Str. 9", "TÜV Kassel", "Abholung (Adresse in der Notiz)"] as const;
const DAY = 86_400_000;

// ---------- Fahrlehrer & Wochenvorlage --------------------------------------------------

/** Solange es nur einen Fahrlehrer gibt: der erste Lehrer-Account (Inhaberin). */
export function mainTeacherId(db: Database.Database): string | null {
  const r = db.prepare(`SELECT id FROM users WHERE role = 'teacher' ORDER BY created_at LIMIT 1`).get() as { id: string } | undefined;
  return r?.id ?? null;
}

/** Vorschlag, bis die Fahrschule ihre Zeiten einträgt: Mo–Fr 9–13 + 14–19 Uhr, Sa 9–14 Uhr. */
export const DEFAULT_TEMPLATE: DayRange[][] = [
  ...Array.from({ length: 5 }, () => [{ from: 540, to: 780 }, { from: 840, to: 1140 }]),
  [{ from: 540, to: 840 }],
];

export function getTemplate(db: Database.Database, teacherId: string): DayRange[][] {
  const rows = db.prepare(`SELECT weekday, start_min, end_min FROM work_template WHERE teacher_id = ? ORDER BY weekday, start_min`).all(teacherId) as Array<{ weekday: number; start_min: number; end_min: number }>;
  const has = db.prepare(`SELECT value FROM settings WHERE key = ?`).get(`template_set:${teacherId}`);
  if (!rows.length && !has) return DEFAULT_TEMPLATE.map((d) => d.map((r) => ({ ...r })));
  const out: DayRange[][] = Array.from({ length: 6 }, () => []);
  for (const r of rows) out[r.weekday].push({ from: r.start_min, to: r.end_min });
  return out;
}

/** Wochenvorlage speichern. Bereiche werden auf 15 Min gerundet, sortiert und zusammengefasst. */
export function saveTemplate(db: Database.Database, teacherId: string, days: DayRange[][]): void {
  const q = (m: number) => Math.round(m / 15) * 15;
  db.transaction(() => {
    db.prepare(`DELETE FROM work_template WHERE teacher_id = ?`).run(teacherId);
    const ins = db.prepare(`INSERT INTO work_template (teacher_id, weekday, start_min, end_min) VALUES (?,?,?,?)`);
    days.slice(0, 6).forEach((ranges, wd) => {
      const sorted = ranges.map((r) => ({ from: q(r.from), to: q(r.to) })).filter((r) => r.to - r.from >= 60 && r.from >= 0 && r.to <= 1440)
        .sort((a, b) => a.from - b.from);
      const merged: DayRange[] = [];
      for (const r of sorted) {
        const last = merged[merged.length - 1];
        if (last && r.from <= last.to) last.to = Math.max(last.to, r.to); else merged.push({ ...r });
      }
      for (const r of merged) ins.run(teacherId, wd, r.from, r.to);
    });
    db.prepare(`INSERT INTO settings (key,value) VALUES (?, '1') ON CONFLICT(key) DO NOTHING`).run(`template_set:${teacherId}`);
  })();
}

// ---------- Einzelne Tage anpassen (überschreibt die Vorlage für dieses Datum) -----------

export function getDayOverride(db: Database.Database, teacherId: string, day: string): DayRange[] | null {
  const r = db.prepare(`SELECT ranges FROM day_overrides WHERE teacher_id = ? AND day = ?`).get(teacherId, day) as { ranges: string } | undefined;
  return r ? (JSON.parse(r.ranges) as DayRange[]) : null;
}

/** Arbeitszeiten eines bestimmten Tages: eigene Zeiten für das Datum, sonst die Wochenvorlage. */
export function dayRanges(db: Database.Database, teacherId: string, day: string): { ranges: DayRange[]; custom: boolean } {
  const o = getDayOverride(db, teacherId, day);
  if (o) return { ranges: o, custom: true };
  const wd = (new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7;
  return { ranges: wd > 5 ? [] : getTemplate(db, teacherId)[wd], custom: false };
}

export function setDayOverride(db: Database.Database, teacherId: string, day: string, ranges: DayRange[] | null): void {
  if (ranges === null) { db.prepare(`DELETE FROM day_overrides WHERE teacher_id = ? AND day = ?`).run(teacherId, day); return; }
  const q = (m: number) => Math.round(m / 15) * 15;
  const clean = ranges.map((r) => ({ from: q(r.from), to: q(r.to) })).filter((r) => r.to - r.from >= 30).sort((a, b) => a.from - b.from);
  db.prepare(`INSERT INTO day_overrides (teacher_id, day, ranges) VALUES (?,?,?) ON CONFLICT(teacher_id, day) DO UPDATE SET ranges = excluded.ranges`)
    .run(teacherId, day, JSON.stringify(clean));
}

/** „Feierabend ab …“: alle Zeiten des Tages enden spätestens zu dieser Uhrzeit (Minuten ab Mitternacht). */
export function finishEarly(db: Database.Database, teacherId: string, day: string, endMin: number): void {
  const { ranges } = dayRanges(db, teacherId, day);
  setDayOverride(db, teacherId, day, ranges.filter((r) => r.from < endMin).map((r) => ({ from: r.from, to: Math.min(r.to, endMin) })));
}

/** Eine Stunde durchstreichen bzw. wieder freigeben (Sperrzeit mit Kennzeichen). */
export const STRIKE_NOTE = "durchgestrichen";
export function toggleStrike(db: Database.Database, teacherId: string, start: number, end: number): "struck" | "restored" {
  const existing = db.prepare(`SELECT id FROM blocks WHERE teacher_id = ? AND starts_at = ? AND ends_at = ? AND note = ?`).get(teacherId, start, end, STRIKE_NOTE) as { id: string } | undefined;
  if (existing) { deleteBlock(db, existing.id); return "restored"; }
  const clash = db.prepare(`SELECT 1 FROM slots WHERE status IN ('reserved','booked') AND starts_at < ? AND ends_at > ?`).get(end, start);
  if (clash) throw new BookingError("In dieser Stunde ist schon eine Fahrt gebucht. Bitte die Fahrt absagen, wenn du sie freihalten willst.");
  addBlock(db, teacherId, start, end, STRIKE_NOTE);
  return "struck";
}

// ---------- Sperrzeiten -----------------------------------------------------------------

export interface Block { id: string; startsAt: number; endsAt: number; note: string }

export function addBlock(db: Database.Database, teacherId: string, start: number, end: number, note: string): void {
  if (!(end > start)) throw new BookingError("Ende muss nach dem Beginn liegen.");
  db.prepare(`INSERT INTO blocks (id, teacher_id, starts_at, ends_at, note, created_at) VALUES (?,?,?,?,?,?)`)
    .run(randomUUID(), teacherId, start, end, note.slice(0, 200), Date.now());
}

export function deleteBlock(db: Database.Database, id: string): void {
  db.prepare(`DELETE FROM blocks WHERE id = ?`).run(id);
}

export function listBlocks(db: Database.Database, from: number, to: number): Block[] {
  return (db.prepare(`SELECT * FROM blocks WHERE ends_at > ? AND starts_at < ? ORDER BY starts_at`).all(from, to) as Array<Record<string, unknown>>)
    .map((r) => ({ id: r.id as string, startsAt: r.starts_at as number, endsAt: r.ends_at as number, note: r.note as string }));
}

// ---------- Freie Zeiten ------------------------------------------------------------------

/**
 * Belegte Zeiten: reservierte/gebuchte Fahrten, Sperrzeiten und Warteliste-Reservierungen
 * (eine Reservierung ist nur für ihren Inhaber frei).
 */
export function busyBetween(db: Database.Database, from: number, to: number, forUser?: string, now = Date.now()): Interval[] {
  const slots = db.prepare(`SELECT starts_at, ends_at FROM slots WHERE status IN ('reserved','booked') AND ends_at > ? AND starts_at < ?`).all(from, to) as Array<{ starts_at: number; ends_at: number }>;
  const holds = activeHolds(db, from, to, now).filter((h) => h.userId !== forUser);
  return [
    ...slots.map((s) => ({ start: s.starts_at, end: s.ends_at })),
    ...listBlocks(db, from, to).map((b) => ({ start: b.startsAt, end: b.endsAt })),
    ...holds.map((h) => ({ start: h.startsAt, end: h.endsAt })),
    ...theoryBusy(db, from, to),
  ];
}

export function freeIntervals(db: Database.Database, teacherId: string, day: string, forUser?: string, now = Date.now()): Interval[] {
  const work = workIntervals(day, dayRanges(db, teacherId, day).ranges);
  if (!work.length) return [];
  return subtract(work, busyBetween(db, berlinToMs(day, "00:00"), berlinToMs(addDays(day, 1), "00:00"), forUser, now));
}

/**
 * Eine Zeit ist frei geworden (Absage, Frist abgelaufen, Ablehnung). Steht jemand passend auf der
 * Warteliste, bekommt Platz 1 eine 30-Minuten-Reservierung. Rückgabe: die Reservierung (oder null).
 */
export function releaseToWaitlist(db: Database.Database, start: number, end: number, exceptUser?: string, now = Date.now()): Hold | null {
  if (start <= now) return null;
  const teacher = mainTeacherId(db);
  if (!teacher) return null;
  const day = dayKey(start);
  // nur den Teil, der jetzt wirklich frei ist
  const free = subtract([{ start, end }], busyBetween(db, berlinToMs(day, "00:00"), berlinToMs(addDays(day, 1), "00:00"), undefined, now));
  const longest = free.sort((a, b) => b.end - b.start - (a.end - a.start))[0];
  if (!longest || longest.end - longest.start < 60 * 60_000) return null;
  const len = (longest.end - longest.start) / 60_000;
  for (const w of waitersFor(db, longest.start, longest.end, exceptUser)) {
    const t = trainingWithBookings(db, w.userId, now);
    if (!t || t.profile.blocked) continue;
    if (!t.state.bookable.some((o) => o.durations.some((d) => d <= len))) continue;
    return createHold(db, w.userId, longest.start, longest.end, now);
  }
  return null;
}

export interface DayOption { day: string; closed: string | null; starts: number[] }

export function earliestStart(db: Database.Database, kind: DriveKind, day: string, now: number): number {
  const lead = now + getSettings(db).minLeadHours * 3_600_000;
  return kind === "beleuchtung" ? Math.max(lead, darkStart(day)) : lead;
}

/** Freie Startzeiten für die nächsten `days` Tage. */
export function availableStarts(db: Database.Database, kind: DriveKind, minutes: number, fromDay: string, days: number, now = Date.now(), forUser?: string): DayOption[] {
  const teacher = mainTeacherId(db);
  if (!teacher) return [];
  const out: DayOption[] = [];
  for (let i = 0; i < days; i++) {
    const day = addDays(fromDay, i);
    const closed = closedReason(day);
    if (closed) { out.push({ day, closed, starts: [] }); continue; }
    const starts = startTimes(freeIntervals(db, teacher, day, forUser, now), minutes, { notBefore: earliestStart(db, kind, day, now) });
    out.push({ day, closed: null, starts });
  }
  return out;
}

// ---------- Ausbildungsstand inkl. gebuchter Fahrten --------------------------------------

export function priceConfig(db: Database.Database): PriceConfig {
  const p = (id: string, fb: number) => getOffer(db, id)?.priceCents || fb;
  return {
    practice45: p("drive-uebung", DEFAULT_PRICES.practice45), special45: p("drive-sonder", DEFAULT_PRICES.special45),
    testfahrtMinutes: testfahrtMinutes(db), testfahrt30: p("drive-testfahrt", DEFAULT_PRICES.testfahrt30),
    testfahrt45: p("drive-uebung", DEFAULT_PRICES.testfahrt45), warmstunde30: p("drive-warmstunde", DEFAULT_PRICES.warmstunde30),
  };
}

/** Aktive Fahrt-Buchungen (angefragt, wartet auf Zahlung, bezahlt) eines Schülers. */
function activeDriveBookings(db: Database.Database, userId: string): Array<{ id: string; kind: DriveKind; minutes: number; starts_at: number; ends_at: number; status: string }> {
  return db.prepare(
    `SELECT b.id, b.kind, b.minutes, b.status, s.starts_at, s.ends_at FROM bookings b JOIN slots s ON s.id = b.slot_id
     WHERE b.user_id = ? AND b.kind IS NOT NULL AND b.status IN ('requested','awaiting_payment','paid')`,
  ).all(userId) as Array<{ id: string; kind: DriveKind; minutes: number; starts_at: number; ends_at: number; status: string }>;
}

/**
 * Bezahlte Fahrten, deren Ende vorbei ist, werden automatisch als „gefahren“ eingetragen.
 * Die Fahrschule kann sie danach noch auf „nicht erschienen“ / „zu spät“ setzen.
 */
export function syncFinishedDrives(db: Database.Database, now = Date.now()): number {
  const rows = db.prepare(
    `SELECT b.id, b.user_id, b.kind, b.minutes, s.starts_at FROM bookings b JOIN slots s ON s.id = b.slot_id
     WHERE b.status = 'paid' AND b.kind IS NOT NULL AND s.ends_at <= ?
       AND NOT EXISTS (SELECT 1 FROM drive_records r WHERE r.booking_id = b.id)`,
  ).all(now) as Array<{ id: string; user_id: string; kind: string; minutes: number; starts_at: number }>;
  const ins = db.prepare(`INSERT INTO drive_records (id,user_id,kind,minutes,at,status,booking_id,source,note,created_by,created_at) VALUES (?,?,?,?,?,'done',?,'booking','',NULL,?)`);
  for (const r of rows) ins.run(randomUUID(), r.user_id, r.kind, r.minutes, r.starts_at, r.id, now);
  return rows.length;
}

export interface FullTraining { profile: ProfileRow; records: StoredRecord[]; state: TrainingState }

/** Ausbildungsstand: gefahrene Fahrten + noch ausstehende Buchungen (als „gebucht“). */
export function trainingWithBookings(db: Database.Database, userId: string, now = Date.now()): FullTraining | null {
  syncFinishedDrives(db, now);
  const profile = getProfile(db, userId);
  if (!profile) return null;
  const records = listRecords(db, userId);
  const recorded = new Set(records.map((r) => r.bookingId).filter(Boolean));
  const planned: DriveRecord[] = activeDriveBookings(db, userId)
    .filter((b) => !recorded.has(b.id))
    .map((b) => ({ kind: b.kind, minutes: b.minutes, status: "planned" as const }));
  const state = computeTraining(profile, [...records, ...planned], { testfahrtMinutes: testfahrtMinutes(db) });
  return { profile, records, state };
}

/** Anzahl gebuchter Fahrten des Schülers in der Kalenderwoche (Mo–So) von `at`. */
export function drivesInWeek(db: Database.Database, userId: string, at: number): number {
  const mon = mondayOf(dayKey(at));
  const from = berlinToMs(mon, "00:00"), to = berlinToMs(addDays(mon, 7), "00:00");
  return activeDriveBookings(db, userId).filter((b) => b.starts_at >= from && b.starts_at < to).length;
}

// ---------- Buchen -------------------------------------------------------------------------

export interface BookDriveInput { userId: string; kind: DriveKind; minutes: number; start: number; meetingPoint: string; note: string }

export function bookDrive(db: Database.Database, inp: BookDriveInput, now = Date.now()): Booking {
  return db.transaction(() => {
    const t = trainingWithBookings(db, inp.userId, now);
    if (!t) throw new BookingError("Deine Führerscheinklasse ist noch nicht festgelegt. Bitte melde dich bei der Fahrschule.");
    if (t.profile.blocked) throw new BookingError("Online-Buchung ist für dich gerade gesperrt. Bitte melde dich bei der Fahrschule.");
    const ok = canBook(t.state, inp.kind, inp.minutes);
    if (!ok.ok) throw new BookingError(ok.reason);
    if (drivesInWeek(db, inp.userId, inp.start) >= t.profile.maxPerWeek) {
      throw new BookingError(`Du hast in dieser Woche schon ${t.profile.maxPerWeek} Fahrten gebucht. Bitte wähle eine andere Woche.`);
    }
    const day = dayKey(inp.start);
    const teacher = mainTeacherId(db);
    if (!teacher) throw new BookingError("Gerade sind keine Termine buchbar.");
    const free = startTimes(freeIntervals(db, teacher, day, inp.userId, now), inp.minutes, { notBefore: earliestStart(db, inp.kind, day, now) });
    if (!free.includes(inp.start)) throw new BookingError("Diese Zeit ist leider nicht mehr frei. Bitte wähle eine andere.");
    const meeting = (MEETING_POINTS as readonly string[]).includes(inp.meetingPoint) ? inp.meetingPoint : MEETING_POINTS[0];

    const offerId = inp.kind === "testfahrt" ? "drive-testfahrt" : ["ueberland", "autobahn", "beleuchtung"].includes(inp.kind) ? "drive-sonder" : "drive-uebung";
    const slotId = randomUUID();
    db.prepare(`INSERT INTO slots (id, offer_id, starts_at, ends_at, status, note, created_at) VALUES (?,?,?,?,'reserved','',?)`)
      .run(slotId, offerId, inp.start, inp.start + inp.minutes * 60_000, now);
    const manual = t.profile.manualApproval;
    const id = randomUUID();
    const s = getSettings(db);
    db.prepare(
      `INSERT INTO bookings (id,user_id,offer_id,slot_id,title,price_cents,status,student_note,created_at,decided_at,pay_deadline,kind,minutes,meeting_point)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    ).run(id, inp.userId, offerId, slotId, `${KIND_LABEL[inp.kind]} · ${inp.minutes} Min`, priceCents(inp.kind, inp.minutes, priceConfig(db)),
      manual ? "requested" : "awaiting_payment", inp.note.trim().slice(0, 300), now, manual ? null : now,
      manual ? null : now + s.payWindowMin * 60_000, inp.kind, inp.minutes, meeting);
    clearHoldsOf(db, inp.userId, inp.start, inp.start + inp.minutes * 60_000);
    return getBooking(db, id)!;
  })();
}

/** Ab wann ist der nächste Tag sinnvoll anzuzeigen (nach dem Vorlauf). */
export function firstBookableDay(db: Database.Database, now = Date.now()): string {
  return dayKey(now + getSettings(db).minLeadHours * 3_600_000);
}

export { DAY };
