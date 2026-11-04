import type Database from "better-sqlite3";
import { randomBytes } from "node:crypto";
import { listSlotsBetween } from "./booking";
import { listBlocks, STRIKE_NOTE } from "./drive-booking";
import { KIND_LABEL } from "../training";
import { SCHOOL } from "../school";

/** Geheimer Abo-Link für den Kalender der Fahrschule (iPhone/Google). */
export function getIcsToken(db: Database.Database): string | null {
  return (db.prepare(`SELECT value FROM settings WHERE key = 'ics_token'`).get() as { value: string } | undefined)?.value ?? null;
}
export function newIcsToken(db: Database.Database): string {
  const t = randomBytes(24).toString("base64url");
  db.prepare(`INSERT INTO settings (key,value) VALUES ('ics_token', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(t);
  return t;
}

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const stamp = (t: number) => new Date(t).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
/** Zeilen nach RFC 5545 auf 75 Zeichen falten. */
const fold = (line: string) => line.length <= 74 ? line : line.match(/.{1,73}/g)!.join("\r\n ");

/** Termine von 30 Tagen zurück bis 120 Tage voraus als iCalendar. */
export function buildIcs(db: Database.Database, now = Date.now()): string {
  const from = now - 30 * 86_400_000, to = now + 120 * 86_400_000;
  const L: string[] = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//beyourself//Fahrschule//DE", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "X-WR-CALNAME:Fahrschule beyourself", "X-WR-TIMEZONE:Europe/Berlin", "REFRESH-INTERVAL;VALUE=DURATION:PT1H", "X-PUBLISHED-TTL:PT1H"];
  for (const s of listSlotsBetween(db, from, to)) {
    const b = s.bookings.find((x) => ["requested", "awaiting_payment", "paid"].includes(x.status));
    if (!b) continue;
    const what = b.kind ? KIND_LABEL[b.kind as keyof typeof KIND_LABEL] : b.title;
    const status = b.status === "paid" ? "bezahlt" : b.status === "requested" ? "ANFRAGE" : "Zahlung offen";
    L.push("BEGIN:VEVENT", `UID:${b.id}@fahrschule-beyourself.de`, `DTSTAMP:${stamp(now)}`, `DTSTART:${stamp(s.startsAt)}`, `DTEND:${stamp(s.endsAt)}`,
      fold(`SUMMARY:${esc(`${b.userName ?? "Schüler"} · ${what}`)}`),
      fold(`LOCATION:${esc(b.meetingPoint || "")}`),
      fold(`DESCRIPTION:${esc(`${b.title} · ${status}${b.userPhone ? ` · Tel. ${b.userPhone}` : ""}${b.studentNote ? `\nNotiz: ${b.studentNote}` : ""}\n${SCHOOL.url}/verwaltung/kalender/termin/${b.id}`)}`),
      `URL:${SCHOOL.url}/verwaltung/kalender/termin/${b.id}`, b.status === "requested" ? "STATUS:TENTATIVE" : "STATUS:CONFIRMED", "END:VEVENT");
  }
  for (const bl of listBlocks(db, from, to)) {
    if (bl.note === STRIKE_NOTE) continue;
    L.push("BEGIN:VEVENT", `UID:block-${bl.id}@fahrschule-beyourself.de`, `DTSTAMP:${stamp(now)}`, `DTSTART:${stamp(bl.startsAt)}`, `DTEND:${stamp(bl.endsAt)}`,
      fold(`SUMMARY:${esc(`🔒 ${bl.note || "Privat"}`)}`), "TRANSP:OPAQUE", "END:VEVENT");
  }
  L.push("END:VCALENDAR");
  return L.join("\r\n") + "\r\n";
}
