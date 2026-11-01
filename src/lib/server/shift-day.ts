import type Database from "better-sqlite3";
import { addDays, berlinToMs } from "../time";
import { listBlocks, STRIKE_NOTE } from "./drive-booking";

/**
 * Alle Termine eines Tages ab einer Uhrzeit gemeinsam um X Minuten verschieben (z. B. Stau, Arzttermin).
 * Prüfungen (fester TÜV-Termin) werden nicht verschoben. Überschneidet sich ein neuer Termin mit einem Termin,
 * der nicht mitverschoben wird, oder mit einem privaten Termin, wird nichts geändert.
 */
export interface ShiftItem { slotId: string; bookingId: string; userId: string; userName: string; userEmail: string; title: string; oldStart: number; oldEnd: number; newStart: number; newEnd: number }

export class ShiftError extends Error {}

export function planShift(db: Database.Database, day: string, fromMin: number, delta: number): ShiftItem[] {
  const dFrom = berlinToMs(day, "00:00"), dTo = berlinToMs(addDays(day, 1), "00:00");
  const cut = dFrom + fromMin * 60_000;
  const rows = db.prepare(`SELECT s.id AS sid, s.starts_at, s.ends_at, b.id AS bid, b.title, b.exam_id, u.id AS uid, u.name, u.email
    FROM slots s JOIN bookings b ON b.slot_id = s.id JOIN users u ON u.id = b.user_id
    WHERE s.starts_at >= ? AND s.starts_at < ? AND s.status IN ('reserved','booked') AND b.status IN ('requested','awaiting_payment','paid')
    ORDER BY s.starts_at`).all(dFrom, dTo) as Array<Record<string, unknown>>;
  const move = rows.filter((r) => Number(r.starts_at) >= cut && !r.exam_id);
  const stay = rows.filter((r) => !move.includes(r));
  const items: ShiftItem[] = move.map((r) => ({
    slotId: r.sid as string, bookingId: r.bid as string, userId: r.uid as string, userName: r.name as string, userEmail: r.email as string, title: r.title as string,
    oldStart: Number(r.starts_at), oldEnd: Number(r.ends_at), newStart: Number(r.starts_at) + delta * 60_000, newEnd: Number(r.ends_at) + delta * 60_000,
  }));
  const hm = (t: number) => new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" }).format(t);
  for (const it of items) {
    if (it.newStart < dFrom || it.newEnd > dTo) throw new ShiftError("Die Termine würden in einen anderen Tag rutschen.");
    for (const s of stay) {
      if (it.newStart < Number(s.ends_at) && it.newEnd > Number(s.starts_at)) {
        throw new ShiftError(`${it.userName} (neu ${hm(it.newStart)}) würde sich mit ${s.name as string} um ${hm(Number(s.starts_at))} Uhr überschneiden${s.exam_id ? " (Prüfung – wird nicht verschoben)" : ""}. Bitte eine frühere Uhrzeit bei „ab“ wählen.`);
      }
    }
    for (const b of listBlocks(db, dFrom, dTo)) {
      if (b.note === STRIKE_NOTE) continue;
      if (it.newStart < b.endsAt && it.newEnd > b.startsAt) throw new ShiftError(`${it.userName} (neu ${hm(it.newStart)}) würde in deinen privaten Termin „${b.note || "Privat"}“ fallen.`);
    }
  }
  return items;
}

export function applyShift(db: Database.Database, items: ShiftItem[]): void {
  const up = db.prepare(`UPDATE slots SET starts_at = ?, ends_at = ? WHERE id = ?`);
  db.transaction(() => { for (const it of items) up.run(it.newStart, it.newEnd, it.slotId); })();
}

/** Text mit Platzhaltern: {name} {alt} {neu} {minuten} */
export function fillShiftText(tpl: string, it: ShiftItem, delta: number): string {
  const hm = (t: number) => new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" }).format(t);
  return tpl.replaceAll("{name}", it.userName.split(" ")[0]).replaceAll("{alt}", hm(it.oldStart)).replaceAll("{neu}", hm(it.newStart))
    .replaceAll("{minuten}", String(Math.abs(delta)));
}
