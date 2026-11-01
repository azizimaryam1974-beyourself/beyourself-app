import { test } from "node:test";
import assert from "node:assert/strict";
import { openDatabase } from "../src/lib/server/db";
import { createUser } from "../src/lib/server/repo";
import { expireDue, getBooking, markPaid, saveSettings } from "../src/lib/server/booking";
import { ensureProfile, getProfile, updateProfile } from "../src/lib/server/training-repo";
import { bookDrive, saveTemplate } from "../src/lib/server/drive-booking";
import { creditBalance, holdCredit } from "../src/lib/server/credit";
import {
  cancelExam, confirmExamPaid, declineExam, ensureGrundbetrag, examMissing, expireExams, getExam, grundbetragPaid, inviteExam, payDeadlineFor, setExamResult,
} from "../src/lib/server/exams";
import { cancelDriveByStudent } from "../src/lib/server/cancel";
import { computeTraining } from "../src/lib/training";
import { berlinToMs } from "../src/lib/time";

const NOW = berlinToMs("2026-11-02", "08:00"); // Montag
const EXAM_DAY = "2026-11-12";

function setup() {
  const db = openDatabase(":memory:");
  const t = createUser(db, { email: "l@x.de", name: "Lehrerin", passwordHash: "x", role: "teacher" });
  const a = createUser(db, { email: "a@x.de", name: "Anna", passwordHash: "x", role: "student" });
  ensureProfile(db, a.id, "b");
  saveSettings(db, { minLeadHours: 2 });
  saveTemplate(db, t.id, Array.from({ length: 6 }, () => [{ from: 540, to: 1260 }]));
  const pay = (id: string, now = NOW) => {
    const b = getBooking(db, id)!;
    const r = markPaid(db, id, { provider: "test", paymentRef: "p", amountCents: b.priceCents - b.creditCents }, now);
    assert.ok(r.ok);
    confirmExamPaid(db, id, now);
  };
  const ready = () => updateProfile(db, a.id, { theoryPassedAt: NOW, pruefauftragAt: NOW, examReadyAt: NOW });
  return { db, t, a, pay, ready };
}

test("Grundbetrag: offene Rechnung bei Anmeldung, Fahrten erst nach Zahlung buchbar", () => {
  const { db, a, pay } = setup();
  const g = ensureGrundbetrag(db, a.id, NOW)!;
  assert.equal(g.priceCents, 52000);
  assert.equal(g.status, "awaiting_payment");
  assert.ok(g.payDeadline! - NOW >= 13 * 86_400_000); // 14 Tage Zeit
  assert.equal(ensureGrundbetrag(db, a.id, NOW)!.id, g.id); // keine doppelte Rechnung
  const drive = () => bookDrive(db, { userId: a.id, kind: "schalter", minutes: 90, start: berlinToMs("2026-11-05", "10:00"), meetingPoint: "", note: "" }, NOW);
  assert.throws(drive, /Grundbetrag/);
  pay(g.id);
  assert.ok(grundbetragPaid(db, a.id));
  assert.equal(ensureGrundbetrag(db, a.id, NOW), null);
  assert.equal(drive().status, "awaiting_payment");
});

test("Grundbetrag: Frist abgelaufen → neue Rechnung; „anders geregelt“ → keine Rechnung", () => {
  const { db, a } = setup();
  const g = ensureGrundbetrag(db, a.id, NOW)!;
  expireDue(db, NOW + 15 * 86_400_000);
  const g2 = ensureGrundbetrag(db, a.id, NOW + 15 * 86_400_000)!;
  assert.notEqual(g2.id, g.id);
  updateProfile(db, a.id, { grundWaived: true });
  assert.ok(grundbetragPaid(db, a.id));
  assert.equal(ensureGrundbetrag(db, a.id, NOW), null);
});

test("Praxisprüfung: nur mit Theorie + Prüfauftrag + Prüfungsreife + Grundbetrag", () => {
  const { db, a, ready } = setup();
  assert.deepEqual(examMissing(db, a.id, "praxis"), ["Grundbetrag bezahlt", "Theorieprüfung bestanden", "Prüfauftrag liegt vor", "Prüfungsreife bestätigt"]);
  const inp = { userId: a.id, type: "praxis" as const, startsAt: berlinToMs(EXAM_DAY, "08:30"), place: "TÜV Kassel", message: "" };
  assert.throws(() => inviteExam(db, inp, NOW), /es fehlt/);
  updateProfile(db, a.id, { grundWaived: true }); ready();
  assert.deepEqual(examMissing(db, a.id, "praxis"), []);
});

test("Praxis: Einladung reserviert Warmstunde + Prüfung, Posten getrennt, Bezahlen = verbindlich", () => {
  const { db, a, pay, ready } = setup();
  updateProfile(db, a.id, { grundWaived: true }); ready();
  const { exam, booking } = inviteExam(db, { userId: a.id, type: "praxis", startsAt: berlinToMs(EXAM_DAY, "08:30"), place: "TÜV Kassel", message: "Bitte pünktlich" }, NOW);
  assert.equal(exam.status, "invited");
  assert.equal(exam.warmAt, berlinToMs(EXAM_DAY, "08:00"));
  assert.equal(booking.priceCents, 4500 + 20000 + 12983);
  assert.deepEqual(booking.lines.map((l) => l.part), ["school", "school", "tuev"]);
  assert.equal(booking.payDeadline, NOW + 3 * 86_400_000);
  assert.equal(booking.startsAt, berlinToMs(EXAM_DAY, "08:00"));
  assert.equal(booking.endsAt, berlinToMs(EXAM_DAY, "09:30"));
  // Zeit ist für andere blockiert
  const b = createUser(db, { email: "b@x.de", name: "Ben", passwordHash: "x", role: "student" });
  ensureProfile(db, b.id, "b"); updateProfile(db, b.id, { grundWaived: true });
  assert.throws(() => bookDrive(db, { userId: b.id, kind: "schalter", minutes: 60, start: berlinToMs(EXAM_DAY, "09:00"), meetingPoint: "", note: "" }, NOW), /nicht mehr frei/);
  // keine zweite offene Praxisprüfung; Schüler kann nicht wie eine Fahrt absagen
  assert.throws(() => inviteExam(db, { userId: a.id, type: "praxis", startsAt: berlinToMs(EXAM_DAY, "12:00"), place: "", message: "" }, NOW), /schon eine offene/);
  pay(booking.id);
  assert.equal(getExam(db, exam.id)!.status, "confirmed");
  assert.throws(() => cancelDriveByStudent(db, a.id, booking.id, NOW), /Prüfungstermine/);
  assert.throws(() => declineExam(db, a.id, exam.id, NOW), /verbindlich/);
  // Ergebnis erst nach Beginn; bestanden → Ausbildung fertig
  assert.throws(() => setExamResult(db, exam.id, "passed", NOW), /nach Prüfungsbeginn/);
  setExamResult(db, exam.id, "passed", berlinToMs(EXAM_DAY, "10:00"));
  const p = getProfile(db, a.id)!;
  assert.ok(p.passedAt);
  const st = computeTraining(p, []);
  assert.match(st.next, /bestanden/);
});

test("Praxis: Konflikt mit gebuchter Fahrt wird abgelehnt", () => {
  const { db, a, ready } = setup();
  updateProfile(db, a.id, { grundWaived: true }); ready();
  const b = createUser(db, { email: "b@x.de", name: "Ben", passwordHash: "x", role: "student" });
  ensureProfile(db, b.id, "b"); updateProfile(db, b.id, { grundWaived: true });
  bookDrive(db, { userId: b.id, kind: "schalter", minutes: 60, start: berlinToMs(EXAM_DAY, "09:00"), meetingPoint: "", note: "" }, NOW);
  assert.throws(() => inviteExam(db, { userId: a.id, type: "praxis", startsAt: berlinToMs(EXAM_DAY, "08:30"), place: "", message: "" }, NOW), /schon eine Fahrt/);
});

test("Theorie: Ablehnen gibt frei; Absage durch Fahrschule nach Zahlung → Guthaben, neue Einladung verrechnet es", () => {
  const { db, a, pay } = setup();
  updateProfile(db, a.id, { grundWaived: true });
  const at = berlinToMs(EXAM_DAY, "10:00");
  const first = inviteExam(db, { userId: a.id, type: "theorie", startsAt: at, place: "TÜV Kassel", message: "" }, NOW);
  assert.equal(first.booking.priceCents, 7000 + 2499);
  declineExam(db, a.id, first.exam.id, NOW);
  assert.equal(getBooking(db, first.booking.id)!.status, "withdrawn");

  const second = inviteExam(db, { userId: a.id, type: "theorie", startsAt: at, place: "TÜV Kassel", message: "" }, NOW);
  pay(second.booking.id);
  const r = cancelExam(db, second.exam.id, NOW + 3_600_000);
  assert.equal(r.creditCents, 9499);
  assert.equal(creditBalance(db, a.id), 9499);

  const third = inviteExam(db, { userId: a.id, type: "theorie", startsAt: at + 7 * 86_400_000, place: "TÜV Kassel", message: "" }, NOW + 7_200_000);
  assert.equal(holdCredit(db, a.id, third.booking.id, third.booking.priceCents, NOW + 7_200_000), 9499); // nichts mehr zu zahlen
  pay(third.booking.id, NOW + 7_200_000);
  setExamResult(db, third.exam.id, "passed", at + 7 * 86_400_000 + 3_600_000);
  assert.ok(getProfile(db, a.id)!.theoryPassedAt);
});

test("Einladung verfällt ohne Zahlung; Frist nie später als 24 Std. vor Beginn", () => {
  const { db, a } = setup();
  updateProfile(db, a.id, { grundWaived: true });
  const soon = NOW + 36 * 3_600_000;
  assert.equal(payDeadlineFor(soon, NOW), soon - 86_400_000);
  const { exam } = inviteExam(db, { userId: a.id, type: "theorie", startsAt: berlinToMs(EXAM_DAY, "10:00"), place: "", message: "" }, NOW);
  expireDue(db, NOW + 4 * 86_400_000);
  assert.equal(expireExams(db, NOW + 4 * 86_400_000).length, 1);
  assert.equal(getExam(db, exam.id)!.status, "expired");
});
