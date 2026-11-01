import { test } from "node:test";
import assert from "node:assert/strict";
import { openDatabase } from "../src/lib/server/db";
import { createUser } from "../src/lib/server/repo";
import { BookingError, expireDue, getBooking, getSettings, markPaid, saveSettings } from "../src/lib/server/booking";
import { ensureProfile, updateProfile } from "../src/lib/server/training-repo";
import { availableStarts, bookDrive, releaseToWaitlist, saveTemplate } from "../src/lib/server/drive-booking";
import { applyNoShow, cancelDriveByStudent, cancelInfo, creditRefills, freeCancelDeadline } from "../src/lib/server/cancel";
import { addCredit, creditBalance, holdCredit, releaseHold } from "../src/lib/server/credit";
import { addWaitlist, activeHolds, notifyTime, takeExpiredHolds } from "../src/lib/server/waitlist";
import { berlinToMs, fmtTime } from "../src/lib/time";

const NOW = berlinToMs("2026-11-02", "08:00"); // Montag
const THU = "2026-11-05";

function setup() {
  const db = openDatabase(":memory:");
  const t = createUser(db, { email: "l@x.de", name: "Lehrerin", passwordHash: "x", role: "teacher" });
  const a = createUser(db, { email: "a@x.de", name: "Anna", passwordHash: "x", role: "student" });
  const b = createUser(db, { email: "b@x.de", name: "Ben", passwordHash: "x", role: "student" });
  const c = createUser(db, { email: "c@x.de", name: "Can", passwordHash: "x", role: "student" });
  for (const u of [a, b, c]) { ensureProfile(db, u.id, "b197"); updateProfile(db, u.id, { grundWaived: true }); }
  saveSettings(db, { minLeadHours: 2 });
  saveTemplate(db, t.id, Array.from({ length: 6 }, () => [{ from: 540, to: 1260 }]));
  const book = (userId: string, hhmm: string, minutes = 75, now = NOW, day = THU) =>
    bookDrive(db, { userId, kind: "automatik", minutes, start: berlinToMs(day, hhmm), meetingPoint: "", note: "" }, now);
  const pay = (id: string, now = NOW) => { const bk = getBooking(db, id)!; assert.ok(markPaid(db, id, { provider: "test", paymentRef: "p", amountCents: bk.priceCents - bk.creditCents }, now).ok); };
  return { db, t, a, b, c, book, pay };
}

test("Frist: 24 Std. vorher, aber spätestens 21 Uhr am Vortag", () => {
  const s = { freeCancelHours: 24, cancelCutoffHour: 21 };
  assert.equal(fmtTime(freeCancelDeadline(berlinToMs(THU, "09:00"), s)), "09:00"); // Mi 9 Uhr
  assert.equal(freeCancelDeadline(berlinToMs(THU, "22:00"), s), berlinToMs("2026-11-04", "21:00"));
});

test("Absage kostenlos → 100 % Guthaben; spät → 70 % berechnet; Last-Minute → nicht möglich", () => {
  const { db, a, book, pay } = setup();
  const b1 = book(a.id, "09:00"); pay(b1.id);
  const r = cancelDriveByStudent(db, a.id, b1.id, NOW);
  assert.equal(r.info.mode, "free");
  assert.equal(creditBalance(db, a.id), 11333);

  const b2 = book(a.id, "15:00"); pay(b2.id);
  const late = berlinToMs("2026-11-04", "21:30");
  const r2 = cancelDriveByStudent(db, a.id, b2.id, late);
  assert.equal(r2.info.mode, "late");
  assert.equal(r2.info.chargeCents, 7933); // 70 % von 113,33 €
  assert.equal(r2.info.creditCents, 3400);

  const lmNow = berlinToMs("2026-11-04", "14:00");
  const b3 = book(a.id, "13:00", 60, lmNow); pay(b3.id, lmNow);
  assert.equal(cancelInfo(getBooking(db, b3.id)!, getSettings(db), lmNow).mode, "lastminute");
  assert.throws(() => cancelDriveByStudent(db, a.id, b3.id, lmNow), /Last-Minute/);
});

test("Spät abgesagt und neu besetzt → Ausfallgebühr zurück (anteilig)", () => {
  const { db, a, b, book, pay } = setup();
  const b1 = book(a.id, "15:00"); pay(b1.id);
  const late = berlinToMs("2026-11-04", "22:00");
  cancelDriveByStudent(db, a.id, b1.id, late);
  const before = creditBalance(db, a.id);
  const nb = book(b.id, "15:00", 75, late); pay(nb.id, late);
  const r = creditRefills(db, getBooking(db, nb.id)!, late);
  assert.equal(r[0].cents, 7933);
  assert.equal(creditBalance(db, a.id), before + 7933);
  assert.deepEqual(creditRefills(db, getBooking(db, nb.id)!, late), [], "nur einmal");
});

test("Nicht erschienen → 75 % berechnet, 25 % Guthaben; zurücknehmbar", () => {
  const { db, a, book, pay } = setup();
  const b1 = book(a.id, "09:00", 60); pay(b1.id);
  assert.equal(applyNoShow(db, b1.id, true), 2267); // 25 % von 90,67 €
  assert.equal(creditBalance(db, a.id), 2267);
  applyNoShow(db, b1.id, false);
  assert.equal(creditBalance(db, a.id), 0);
});

test("Guthaben wird beim Bezahlen verrechnet; Frist abgelaufen → zurück", () => {
  const { db, a, book } = setup();
  addCredit(db, { userId: a.id, amountCents: 5000, reason: "manual" });
  const b1 = book(a.id, "09:00");
  assert.equal(holdCredit(db, a.id, b1.id, b1.priceCents), 5000);
  assert.equal(holdCredit(db, a.id, b1.id, b1.priceCents), 5000, "zweimal klicken bucht nicht doppelt ab");
  assert.equal(creditBalance(db, a.id), 0);
  assert.equal(markPaid(db, b1.id, { provider: "test", paymentRef: "x", amountCents: 11333 }, NOW).ok, false, "voller Betrag passt nicht");
  expireDue(db, NOW + 31 * 60_000);
  releaseHold(db, b1.id);
  assert.equal(creditBalance(db, a.id), 5000);
});

test("Warteliste: 1×/Woche, Platz 1 exklusiv 30 Min, danach für alle", () => {
  const { db, a, b, c, book, pay } = setup();
  addWaitlist(db, b.id, THU, 540, 720, NOW);
  addWaitlist(db, c.id, THU, 600, 900, NOW + 1);
  assert.throws(() => addWaitlist(db, b.id, "2026-11-06", 540, 720, NOW), BookingError);
  const bk = book(a.id, "10:00"); pay(bk.id);
  const at = berlinToMs("2026-11-02", "12:00");
  cancelDriveByStudent(db, a.id, bk.id, at);
  const hold = releaseToWaitlist(db, berlinToMs(THU, "10:00"), berlinToMs(THU, "11:15"), a.id, at)!;
  assert.equal(hold.userId, b.id, "Platz 1");
  assert.equal(hold.expiresAt, at + 30 * 60_000);
  // Can sieht die Zeit nicht, Ben schon
  const forC = availableStarts(db, "automatik", 75, THU, 1, at, c.id)[0].starts.map(fmtTime);
  const forB = availableStarts(db, "automatik", 75, THU, 1, at, b.id)[0].starts.map(fmtTime);
  assert.ok(!forC.includes("10:00") && forB.includes("10:00"));
  // nach 30 Min frei für alle
  assert.equal(takeExpiredHolds(db, at + 31 * 60_000).length, 1);
  assert.equal(activeHolds(db, 0, Infinity, at + 31 * 60_000).length, 0);
  assert.ok(availableStarts(db, "automatik", 75, THU, 1, at + 31 * 60_000, c.id)[0].starts.map(fmtTime).includes("10:00"));
});

test("Nachtruhe: Nachricht und 30 Min erst ab 7 Uhr", () => {
  assert.equal(notifyTime(berlinToMs("2026-11-02", "23:15")), berlinToMs("2026-11-03", "07:00"));
  assert.equal(notifyTime(berlinToMs("2026-11-03", "05:00")), berlinToMs("2026-11-03", "07:00"));
  assert.equal(notifyTime(berlinToMs("2026-11-03", "12:00")), berlinToMs("2026-11-03", "12:00"));
});
