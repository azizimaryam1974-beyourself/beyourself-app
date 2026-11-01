import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { BookingError, getBooking, getOffer, type Booking, type BookingLine } from "./booking";
import { addCredit, releaseHold } from "./credit";
import { getProfile, grundbetragPaid, updateProfile } from "./training-repo";
import { theoryBusy } from "./theory";
import { priceCents } from "../training";
import { priceConfig } from "./drive-booking";

/**
 * Schritt 4 – Grundbetrag und Prüfungen (Entscheidungen von Maryam, ARBEITSWEISE.md):
 *
 * Grundbetrag: wird mit der Anmeldung fällig (eine offene Rechnung im Konto). Fahrstunden kann man
 * erst buchen, wenn er bezahlt ist – oder die Fahrschule ihn als „anders geregelt“ markiert
 * (z. B. vor der App bar bezahlt).
 *
 * Prüfungen: den Termin legt NUR die Fahrschule fest (nach Bestätigung durch den TÜV) und lädt ein.
 * Der Schüler bestätigt verbindlich, indem er bis zur Frist bezahlt:
 *   Theorieprüfung  = Gebühr Fahrschule + TÜV-Gebühr
 *   Praxisprüfung   = Warmstunde + Gebühr Fahrschule + TÜV-Gebühr (Warmstunde + Prüfung blockieren den Kalender)
 * Fahrschule und TÜV stehen als getrennte Posten auf der Buchung (für die Rechnung: TÜV = durchlaufender Posten).
 * Wer nicht erscheint, verliert die Gebühren. Verschiebt die Fahrschule/der TÜV, geht alles als Guthaben zurück
 * und wird bei der neuen Einladung automatisch verrechnet.
 */

export type ExamType = "theorie" | "praxis";
export type ExamStatus = "invited" | "confirmed" | "declined" | "expired" | "cancelled" | "passed" | "failed" | "no_show";

export interface Exam {
  id: string; userId: string; type: ExamType; startsAt: number; place: string; warmAt: number | null;
  status: ExamStatus; bookingId: string | null; message: string; createdAt: number; decidedAt: number | null;
}

export const EXAM_LABEL: Record<ExamType, string> = { theorie: "Theorieprüfung", praxis: "Praktische Prüfung" };
export const EXAM_STATUS_LABEL: Record<ExamStatus, string> = {
  invited: "Eingeladen – bitte bestätigen", confirmed: "Bestätigt", declined: "Abgelehnt", expired: "Nicht bestätigt (Frist vorbei)",
  cancelled: "Abgesagt", passed: "Bestanden", failed: "Nicht bestanden", no_show: "Nicht erschienen",
};
export const EXAM_PLACES = ["TÜV Kassel", "Fahrschule, Rudolf-Schwander-Str. 9"] as const;

/** Prüfungsdauer (Kalender) und Zahlungsfristen */
export const PRAXIS_MIN = 60;
export const WARM_MIN = 30;
export const GRUND_PAY_DAYS = 14;
export const EXAM_PAY_DAYS = 3;
const DAY = 86_400_000;

type Row = Record<string, unknown>;
const mapExam = (r: Row): Exam => ({
  id: r.id as string, userId: r.user_id as string, type: r.type as ExamType, startsAt: Number(r.starts_at), place: r.place as string,
  warmAt: r.warm_at === null || r.warm_at === undefined ? null : Number(r.warm_at), status: r.status as ExamStatus,
  bookingId: (r.booking_id as string) ?? null, message: r.message as string, createdAt: Number(r.created_at),
  decidedAt: r.decided_at === null || r.decided_at === undefined ? null : Number(r.decided_at),
});

export function getExam(db: Database.Database, id: string): Exam | undefined {
  const r = db.prepare(`SELECT * FROM exams WHERE id = ?`).get(id) as Row | undefined;
  return r ? mapExam(r) : undefined;
}
export function listExams(db: Database.Database, userId: string): Exam[] {
  return (db.prepare(`SELECT * FROM exams WHERE user_id = ? ORDER BY starts_at DESC`).all(userId) as Row[]).map(mapExam);
}
/** Alle Prüfungen in einem Zeitraum (für die Übersicht der Fahrschule). */
export function listExamsBetween(db: Database.Database, from: number, to: number): Array<Exam & { userName: string }> {
  return (db.prepare(`SELECT e.*, u.name AS user_name FROM exams e JOIN users u ON u.id = e.user_id
    WHERE e.starts_at >= ? AND e.starts_at < ? AND e.status IN ('invited','confirmed') ORDER BY e.starts_at`).all(from, to) as Row[])
    .map((r) => ({ ...mapExam(r), userName: r.user_name as string }));
}

// ---------- Grundbetrag ------------------------------------------------------------------

function feePrice(db: Database.Database, id: string, fallback: number): number {
  return getOffer(db, id)?.priceCents || fallback;
}

export { grundbetragPaid };

/**
 * Sorgt dafür, dass ein Schüler mit Klasse eine offene Rechnung über den Grundbetrag hat
 * (bei der Anmeldung, und erneut, falls die Frist ohne Zahlung abgelaufen ist).
 */
export function ensureGrundbetrag(db: Database.Database, userId: string, now = Date.now()): Booking | null {
  if (!getProfile(db, userId) || grundbetragPaid(db, userId)) return null;
  const open = db.prepare(`SELECT id FROM bookings WHERE user_id = ? AND offer_id = 'fee-grundbetrag' AND status IN ('requested','awaiting_payment')`).get(userId) as { id: string } | undefined;
  if (open) return getBooking(db, open.id)!;
  const price = feePrice(db, "fee-grundbetrag", 52000);
  if (price <= 0) return null;
  const id = randomUUID();
  db.prepare(`INSERT INTO bookings (id,user_id,offer_id,title,price_cents,status,student_note,created_at,decided_at,pay_deadline,lines)
    VALUES (?,?,?,?,?,'awaiting_payment','',?,?,?,?)`)
    .run(id, userId, "fee-grundbetrag", "Grundbetrag", price, now, now, now + GRUND_PAY_DAYS * DAY,
      JSON.stringify([{ label: "Grundbetrag (inkl. Theorie-App, Theorieunterricht, Lernmaterial, Verwaltung)", cents: price, part: "school" }] satisfies BookingLine[]));
  return getBooking(db, id)!;
}

// ---------- Einladung ------------------------------------------------------------------

export interface InviteInput {
  userId: string; type: ExamType; startsAt: number; place: string; message: string;
  /** Nur Praxis: Beginn der Warmstunde (Standard: 30 Min vor der Prüfung) */
  warmAt?: number | null;
}

/** Was fehlt noch für die Einladung? (leer = alles da) */
export function examMissing(db: Database.Database, userId: string, type: ExamType): string[] {
  const p = getProfile(db, userId);
  if (!p) return ["Führerscheinklasse festlegen"];
  const miss: string[] = [];
  if (!grundbetragPaid(db, userId)) miss.push("Grundbetrag bezahlt");
  if (type === "praxis") {
    if (!p.theoryPassedAt) miss.push("Theorieprüfung bestanden");
    if (!p.pruefauftragAt) miss.push("Prüfauftrag liegt vor");
    if (!p.examReadyAt) miss.push("Prüfungsreife bestätigt");
    if (p.passedAt) miss.push("(Praktische Prüfung ist schon bestanden)");
  } else if (p.theoryPassedAt) miss.push("(Theorieprüfung ist schon bestanden)");
  return miss;
}

/** Offene oder bestätigte Prüfung dieser Art? */
function activeExam(db: Database.Database, userId: string, type: ExamType): Exam | undefined {
  const r = db.prepare(`SELECT * FROM exams WHERE user_id = ? AND type = ? AND status IN ('invited','confirmed')`).get(userId, type) as Row | undefined;
  return r ? mapExam(r) : undefined;
}

export function payDeadlineFor(firstAt: number, now: number): number {
  // 3 Tage Zeit, aber spätestens 24 Std. vor Beginn (bei sehr kurzfristigen Terminen: 2 Std. vorher)
  const latest = firstAt - DAY > now + 3_600_000 ? firstAt - DAY : firstAt - 2 * 3_600_000;
  return Math.max(now + 30 * 60_000, Math.min(now + EXAM_PAY_DAYS * DAY, latest));
}

export function inviteExam(db: Database.Database, inp: InviteInput, now = Date.now()): { exam: Exam; booking: Booking } {
  return db.transaction(() => {
    const p = getProfile(db, inp.userId);
    if (!p) throw new BookingError("Für diesen Schüler ist noch keine Klasse festgelegt.");
    const missing = examMissing(db, inp.userId, inp.type);
    if (missing.length) throw new BookingError(`Noch nicht möglich – es fehlt: ${missing.join(", ")}.`);
    if (activeExam(db, inp.userId, inp.type)) throw new BookingError(`Es gibt schon eine offene ${EXAM_LABEL[inp.type]}. Bitte diese zuerst absagen oder das Ergebnis eintragen.`);
    if (!Number.isFinite(inp.startsAt) || inp.startsAt < now + 2 * 3_600_000) throw new BookingError("Der Prüfungstermin muss mindestens 2 Stunden in der Zukunft liegen.");

    const lines: BookingLine[] = [];
    let slotId: string | null = null, kind: string | null = null, minutes: number | null = null, warmAt: number | null = null;
    const examId = randomUUID();
    if (inp.type === "praxis") {
      warmAt = inp.warmAt ?? inp.startsAt - WARM_MIN * 60_000;
      if (warmAt > inp.startsAt - WARM_MIN * 60_000) throw new BookingError("Die Warmstunde (30 Min) muss vor der Prüfung liegen.");
      if (inp.startsAt - warmAt > 4 * 3_600_000) throw new BookingError("Die Warmstunde sollte am Prüfungstag direkt vorher sein.");
      const end = inp.startsAt + PRAXIS_MIN * 60_000;
      // Kalender: Warmstunde + Prüfung dürfen keine gebuchte Fahrt oder Theoriestunde überschneiden
      const clash = db.prepare(`SELECT 1 FROM slots WHERE status IN ('reserved','booked') AND starts_at < ? AND ends_at > ?`).get(end, warmAt)
        || theoryBusy(db, warmAt, end).length > 0;
      if (clash) throw new BookingError("Zu dieser Zeit ist schon eine Fahrt oder Theoriestunde im Kalender. Bitte zuerst verschieben.");
      slotId = randomUUID();
      db.prepare(`INSERT INTO slots (id, offer_id, starts_at, ends_at, status, note, created_at) VALUES (?,?,?,?,'reserved',?,?)`)
        .run(slotId, "drive-warmstunde", warmAt, end, "Warmstunde + Prüfung", now);
      kind = "warmstunde"; minutes = WARM_MIN;
      lines.push({ label: "Warmstunde (30 Min) direkt vor der Prüfung", cents: priceCents("warmstunde", WARM_MIN, priceConfig(db)), part: "school" });
      lines.push({ label: "Vorstellung zur praktischen Prüfung (Fahrschule)", cents: feePrice(db, "fee-pruefung", 20000), part: "school" });
      lines.push({ label: "TÜV-Gebühr praktische Prüfung (wird an den TÜV weitergeleitet)", cents: feePrice(db, "fee-tuev-praxis", 12983), part: "tuev" });
    } else {
      lines.push({ label: "Vorstellung zur Theorieprüfung (Fahrschule)", cents: feePrice(db, "fee-theorie", 7000), part: "school" });
      lines.push({ label: "TÜV-Gebühr Theorieprüfung (wird an den TÜV weitergeleitet)", cents: feePrice(db, "fee-tuev-theorie", 2499), part: "tuev" });
    }
    const total = lines.reduce((a, l) => a + l.cents, 0);
    const bookingId = randomUUID();
    const firstAt = warmAt ?? inp.startsAt;
    const place = inp.place.trim().slice(0, 120) || EXAM_PLACES[0];
    db.prepare(`INSERT INTO bookings (id,user_id,offer_id,slot_id,title,price_cents,status,student_note,created_at,decided_at,pay_deadline,kind,minutes,meeting_point,admin_message,exam_id,lines)
      VALUES (?,?,?,?,?,?,'awaiting_payment','',?,?,?,?,?,?,?,?,?)`)
      .run(bookingId, inp.userId, inp.type === "praxis" ? "fee-pruefung" : "fee-theorie", slotId, EXAM_LABEL[inp.type], total, now, now,
        payDeadlineFor(firstAt, now), kind, minutes, place, inp.message.trim().slice(0, 1000), examId, JSON.stringify(lines));
    db.prepare(`INSERT INTO exams (id,user_id,type,starts_at,place,warm_at,status,booking_id,message,created_at) VALUES (?,?,?,?,?,?,'invited',?,?,?)`)
      .run(examId, inp.userId, inp.type, inp.startsAt, place, warmAt, bookingId, inp.message.trim().slice(0, 1000), now);
    return { exam: getExam(db, examId)!, booking: getBooking(db, bookingId)! };
  })();
}

/** Zahlung eingegangen → Einladung verbindlich bestätigt. */
export function confirmExamPaid(db: Database.Database, bookingId: string, now = Date.now()): Exam | null {
  const b = getBooking(db, bookingId);
  if (!b?.examId || b.status !== "paid") return null;
  db.prepare(`UPDATE exams SET status = 'confirmed', decided_at = ? WHERE id = ? AND status = 'invited'`).run(now, b.examId);
  return getExam(db, b.examId) ?? null;
}

/** Schüler lehnt die Einladung ab (nur solange noch nicht bezahlt). */
export function declineExam(db: Database.Database, userId: string, examId: string, now = Date.now()): Exam {
  return db.transaction(() => {
    const e = getExam(db, examId);
    if (!e || e.userId !== userId) throw new BookingError("Einladung nicht gefunden.");
    if (e.status !== "invited") throw new BookingError("Diese Prüfung ist schon verbindlich bestätigt. Bitte ruf in der Fahrschule an.");
    closeExamBooking(db, e, "withdrawn", now);
    db.prepare(`UPDATE exams SET status = 'declined', decided_at = ? WHERE id = ?`).run(now, e.id);
    return getExam(db, e.id)!;
  })();
}

function closeExamBooking(db: Database.Database, e: Exam, status: "withdrawn" | "cancelled", now: number): Booking | undefined {
  const b = e.bookingId ? getBooking(db, e.bookingId) : undefined;
  if (!b) return undefined;
  if (b.status === "awaiting_payment" || b.status === "requested") {
    db.prepare(`UPDATE bookings SET status = ?, cancelled_at = ?, cancelled_by = ? WHERE id = ?`).run(status, now, status === "withdrawn" ? "student" : "school", b.id);
    releaseHold(db, b.id, now);
  }
  if (b.slotId) db.prepare(`UPDATE slots SET status = 'closed' WHERE id = ?`).run(b.slotId);
  return b;
}

/**
 * Fahrschule sagt ab / TÜV verschiebt. Schon Bezahltes geht komplett als Guthaben zurück
 * (wird bei der nächsten Einladung automatisch verrechnet).
 */
export function cancelExam(db: Database.Database, examId: string, now = Date.now()): { exam: Exam; creditCents: number } {
  return db.transaction(() => {
    const e = getExam(db, examId);
    if (!e) throw new BookingError("Prüfung nicht gefunden.");
    if (e.status !== "invited" && e.status !== "confirmed") throw new BookingError("Diese Prüfung ist schon abgeschlossen.");
    const b = closeExamBooking(db, e, "cancelled", now);
    let creditCents = 0;
    if (b?.status === "paid") {
      db.prepare(`UPDATE bookings SET status = 'cancelled', cancelled_at = ?, cancelled_by = 'school' WHERE id = ?`).run(now, b.id);
      creditCents = b.priceCents;
      addCredit(db, { userId: e.userId, bookingId: b.id, amountCents: creditCents, reason: "school_cancel", note: EXAM_LABEL[e.type] }, now);
    }
    db.prepare(`UPDATE exams SET status = 'cancelled', decided_at = ? WHERE id = ?`).run(now, e.id);
    return { exam: getExam(db, e.id)!, creditCents };
  })();
}

/** Ergebnis eintragen. Theorie bestanden → im Ausbildungsstand abgehakt; Praxis bestanden → Ausbildung fertig. */
export function setExamResult(db: Database.Database, examId: string, result: "passed" | "failed" | "no_show", now = Date.now()): Exam {
  return db.transaction(() => {
    const e = getExam(db, examId);
    if (!e) throw new BookingError("Prüfung nicht gefunden.");
    if (e.status !== "confirmed" && !["passed", "failed", "no_show"].includes(e.status)) {
      throw new BookingError("Ein Ergebnis gibt es nur für bestätigte (bezahlte) Prüfungen.");
    }
    if (now < e.startsAt) throw new BookingError("Das Ergebnis kann erst nach Prüfungsbeginn eingetragen werden.");
    db.prepare(`UPDATE exams SET status = ?, decided_at = ? WHERE id = ?`).run(result, now, e.id);
    const p = getProfile(db, e.userId);
    if (p) {
      if (e.type === "theorie") updateProfile(db, e.userId, { theoryPassedAt: result === "passed" ? (p.theoryPassedAt ?? now) : null });
      else updateProfile(db, e.userId, { passedAt: result === "passed" ? now : null });
    }
    return getExam(db, e.id)!;
  })();
}

/** Einladungen, deren Zahlungsfrist abgelaufen ist (Buchung „expired“) → Einladung verfallen. */
export function expireExams(db: Database.Database, now = Date.now()): Exam[] {
  const rows = db.prepare(`SELECT e.* FROM exams e JOIN bookings b ON b.id = e.booking_id WHERE e.status = 'invited' AND b.status = 'expired'`).all() as Row[];
  for (const r of rows) db.prepare(`UPDATE exams SET status = 'expired', decided_at = ? WHERE id = ?`).run(now, r.id);
  return rows.map(mapExam);
}

/** Erinnerung einmal, wenn weniger als 24 Std. zum Bestätigen bleiben. */
export function examsDueForReminder(db: Database.Database, now = Date.now()): Booking[] {
  const ids = db.prepare(`SELECT id FROM bookings WHERE exam_id IS NOT NULL AND status = 'awaiting_payment' AND reminded = 0 AND pay_deadline BETWEEN ? AND ?`)
    .all(now, now + DAY) as Array<{ id: string }>;
  const upd = db.prepare(`UPDATE bookings SET reminded = 1 WHERE id = ?`);
  return ids.map(({ id }) => { upd.run(id); return getBooking(db, id)!; });
}
