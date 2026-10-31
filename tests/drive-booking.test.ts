import { test } from "node:test";
import assert from "node:assert/strict";
import { openDatabase } from "../src/lib/server/db";
import { createUser } from "../src/lib/server/repo";
import { BookingError, cancelByAdmin, cancelByStudent, confirmBooking, declineBooking, expireDue, getBooking, markPaid, saveSettings } from "../src/lib/server/booking";
import { ensureProfile, updateProfile } from "../src/lib/server/training-repo";
import { addBlock, availableStarts, bookDrive, saveTemplate, syncFinishedDrives, trainingWithBookings } from "../src/lib/server/drive-booking";
import { berlinToMs, fmtTime } from "../src/lib/time";

// Montag 02.11.2026, 8 Uhr – Termine ab Dienstag
const NOW = berlinToMs("2026-11-02", "08:00");
const TUE = "2026-11-03";

function setup(cls: "b197" | "b" = "b197") {
  const db = openDatabase(":memory:");
  const teacher = createUser(db, { email: "l@x.de", name: "Lehrerin", passwordHash: "x", role: "teacher" });
  const a = createUser(db, { email: "a@x.de", name: "Anna", passwordHash: "x", role: "student" });
  const b = createUser(db, { email: "b@x.de", name: "Ben", passwordHash: "x", role: "student" });
  ensureProfile(db, a.id, cls); ensureProfile(db, b.id, cls);
  saveSettings(db, { minLeadHours: 12 });
  // Di: 9–12 Uhr
  saveTemplate(db, teacher.id, [[], [{ from: 540, to: 720 }], [], [], [], []]);
  return { db, teacher, a, b };
}
const times = (o: ReturnType<typeof availableStarts>, day = TUE) => o.find((d) => d.day === day)!.starts.map(fmtTime);

test("Freie Zeiten aus der Wochenvorlage; Sonntag/Feiertag zu", () => {
  const { db } = setup();
  const opts = availableStarts(db, "automatik", 75, "2026-11-02", 7, NOW);
  assert.deepEqual(times(opts), ["09:00", "10:45"]); // 9:00 (danach 105 frei) oder 10:45 (davor 105 frei)
  assert.equal(opts.find((d) => d.day === "2026-11-08")!.closed, "Sonntag");
  assert.deepEqual(times(opts, "2026-11-04"), []);
});

test("Buchen: Regeln greifen, Zeit wird sofort reserviert, automatisch bestätigt", () => {
  const { db, a, b } = setup();
  assert.throws(() => bookDrive(db, { userId: a.id, kind: "schalter", minutes: 60, start: berlinToMs(TUE, "09:00"), meetingPoint: "", note: "" }, NOW), BookingError);
  assert.throws(() => bookDrive(db, { userId: a.id, kind: "automatik", minutes: 90, start: berlinToMs(TUE, "09:00"), meetingPoint: "", note: "" }, NOW), /60, 75/);
  const bk = bookDrive(db, { userId: a.id, kind: "automatik", minutes: 75, start: berlinToMs(TUE, "09:00"), meetingPoint: "TÜV Kassel", note: "" }, NOW);
  assert.equal(bk.status, "awaiting_payment");
  assert.equal(bk.priceCents, 11333);
  assert.equal(bk.meetingPoint, "TÜV Kassel");
  // Zeit ist weg für Ben
  assert.throws(() => bookDrive(db, { userId: b.id, kind: "automatik", minutes: 75, start: berlinToMs(TUE, "09:00"), meetingPoint: "", note: "" }, NOW), /nicht mehr frei/);
  // Fortschritt zählt die Buchung als „gebucht“; Rest 60 Min
  const t = trainingWithBookings(db, a.id, NOW)!;
  assert.equal(t.state.phases[0].counters[0].planned, 75);
  assert.deepEqual(t.state.bookable[0].durations, [60]);
});

test("Frist abgelaufen → Zeit wieder frei; Wochenlimit; Sperre", () => {
  const { db, a, b } = setup();
  const bk = bookDrive(db, { userId: a.id, kind: "automatik", minutes: 75, start: berlinToMs(TUE, "09:00"), meetingPoint: "", note: "" }, NOW);
  expireDue(db, NOW + 31 * 60_000);
  assert.equal(getBooking(db, bk.id)!.status, "expired");
  assert.deepEqual(times(availableStarts(db, "automatik", 75, TUE, 1, NOW)), ["09:00", "10:45"]);
  updateProfile(db, b.id, { maxPerWeek: 1 });
  bookDrive(db, { userId: b.id, kind: "automatik", minutes: 60, start: berlinToMs(TUE, "09:00"), meetingPoint: "", note: "" }, NOW);
  assert.throws(() => bookDrive(db, { userId: b.id, kind: "automatik", minutes: 75, start: berlinToMs(TUE, "10:45"), meetingPoint: "", note: "" }, NOW), /in dieser Woche/);
  updateProfile(db, a.id, { blocked: true });
  assert.throws(() => bookDrive(db, { userId: a.id, kind: "automatik", minutes: 75, start: berlinToMs(TUE, "10:45"), meetingPoint: "", note: "" }, NOW), /gesperrt/);
});

test("Nur mit Freigabe: Anfrage hält die Zeit, Bestätigung → zahlen, Ablehnung → frei", () => {
  const { db, a } = setup();
  updateProfile(db, a.id, { manualApproval: true });
  const bk = bookDrive(db, { userId: a.id, kind: "automatik", minutes: 75, start: berlinToMs(TUE, "09:00"), meetingPoint: "", note: "" }, NOW);
  assert.equal(bk.status, "requested");
  assert.ok(!times(availableStarts(db, "automatik", 75, TUE, 1, NOW)).includes("09:00"), "Zeit ist gehalten");
  const { booking } = confirmBooking(db, bk.id, "ok", "", NOW);
  assert.equal(booking.status, "awaiting_payment");
  const bk2 = bookDrive(db, { userId: a.id, kind: "automatik", minutes: 60, start: berlinToMs(TUE, "11:00"), meetingPoint: "", note: "" }, NOW);
  declineBooking(db, bk2.id, "nein", NOW);
  assert.ok(times(availableStarts(db, "automatik", 60, TUE, 1, NOW)).length > 0);
});

test("Bezahlt + vorbei → automatisch gefahren; Absage Fahrschule ohne Freigabe sperrt die Zeit", () => {
  const { db, a } = setup();
  const bk = bookDrive(db, { userId: a.id, kind: "automatik", minutes: 75, start: berlinToMs(TUE, "09:00"), meetingPoint: "", note: "" }, NOW);
  assert.ok(markPaid(db, bk.id, { provider: "test", paymentRef: "p", amountCents: 11333 }, NOW).ok);
  assert.equal(syncFinishedDrives(db, berlinToMs(TUE, "10:20")), 1);
  const t = trainingWithBookings(db, a.id, berlinToMs(TUE, "10:20"))!;
  assert.equal(t.state.phases[0].counters[0].done, 75);
  assert.equal(t.state.phases[0].counters[0].planned, 0);

  const bk2 = bookDrive(db, { userId: a.id, kind: "automatik", minutes: 60, start: berlinToMs(TUE, "11:00"), meetingPoint: "", note: "" }, NOW);
  cancelByAdmin(db, bk2.id, { message: "krank", refund: true, reopenSlot: false }, NOW);
  assert.deepEqual(times(availableStarts(db, "automatik", 60, TUE, 1, NOW)), [], "nach Absage gesperrt");
});

test("Beleuchtung erst nach Sonnenuntergang; Sperrzeit blockiert", () => {
  const { db, teacher, a } = setup();
  saveTemplate(db, teacher.id, [[], [{ from: 540, to: 1260 }], [], [], [], []]);
  updateProfile(db, a.id, { testfahrtPassedAt: 1 });
  const t = availableStarts(db, "beleuchtung", 135, TUE, 1, NOW)[0].starts.map(fmtTime);
  assert.ok(t.length > 0 && t.every((x) => x >= "17:00"), t.join(","));
  addBlock(db, teacher.id, berlinToMs(TUE, "09:00"), berlinToMs(TUE, "21:00"), "Urlaub");
  assert.deepEqual(availableStarts(db, "automatik", 60, TUE, 1, NOW)[0].starts, []);
  void cancelByStudent;
});

import { dayRanges, finishEarly, setDayOverride, toggleStrike } from "../src/lib/server/drive-booking";

test("Tag anpassen: früher Feierabend, eigene Zeiten, Stunde durchstreichen", () => {
  const { db, teacher, a } = setup();
  finishEarly(db, teacher.id, TUE, 11 * 60);
  assert.deepEqual(dayRanges(db, teacher.id, TUE), { ranges: [{ from: 540, to: 660 }], custom: true });
  assert.deepEqual(times(availableStarts(db, "automatik", 60, TUE, 1, NOW)), ["09:00", "10:00"]);
  // Mittwoch ausnahmsweise arbeiten (laut Vorlage frei)
  setDayOverride(db, teacher.id, "2026-11-04", [{ from: 14 * 60, to: 16 * 60 }]);
  assert.deepEqual(times(availableStarts(db, "automatik", 60, "2026-11-04", 1, NOW), "2026-11-04"), ["14:00", "15:00"]);
  // zurück zur Vorlage
  setDayOverride(db, teacher.id, TUE, null);
  assert.equal(dayRanges(db, teacher.id, TUE).custom, false);
  // 10–11 durchstreichen und wieder freigeben
  const s = berlinToMs(TUE, "10:00"), e = berlinToMs(TUE, "11:00");
  assert.equal(toggleStrike(db, teacher.id, s, e), "struck");
  assert.ok(!times(availableStarts(db, "automatik", 60, TUE, 1, NOW)).includes("10:00"));
  assert.equal(toggleStrike(db, teacher.id, s, e), "restored");
  assert.ok(times(availableStarts(db, "automatik", 60, TUE, 1, NOW)).includes("10:00"));
  // gebuchte Stunde kann nicht durchgestrichen werden
  bookDrive(db, { userId: a.id, kind: "automatik", minutes: 60, start: s, meetingPoint: "", note: "" }, NOW);
  assert.throws(() => toggleStrike(db, teacher.id, s, e), /schon eine Fahrt/);
});
