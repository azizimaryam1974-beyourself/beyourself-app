import { test } from "node:test";
import assert from "node:assert/strict";
import { openDatabase } from "../src/lib/server/db";
import { createUser, bookPackage, currentPackage } from "../src/lib/server/repo";
import {
  BookingError, cancelByAdmin, cancelByStudent, closeSlot, confirmBooking, createSlots, declineBooking, expireDue,
  getBooking, getSlot, isBookable, listOffers, listOpenSlots, markPaid, orderProduct, requestSlot, saveOffer, saveSettings,
} from "../src/lib/server/booking";
import { berlinToMs, dayKey, fmtTime, mondayOf, weekdayOf } from "../src/lib/time";

const H = 3_600_000;

function setup() {
  const db = openDatabase(":memory:");
  const a = createUser(db, { email: "a@x.de", name: "Anna", passwordHash: "x", role: "student" });
  const b = createUser(db, { email: "b@x.de", name: "Ben", passwordHash: "x", role: "student" });
  const offer = listOffers(db).find((o) => o.title === "Übungsfahrt")!;
  saveOffer(db, { ...offer, priceCents: 6500 });
  const now = Date.UTC(2026, 10, 2, 9, 0);
  const start = now + 48 * H;
  const { created } = createSlots(db, offer.id, [start], now);
  return { db, a, b, offer: { ...offer, priceCents: 6500 }, now, start, slot: created[0] };
}

test("Zeit: deutsche Zeit inkl. Winterzeit", () => {
  const ms = berlinToMs("2026-11-03", "08:30");
  assert.equal(new Date(ms).toISOString(), "2026-11-03T07:30:00.000Z");
  assert.equal(new Date(berlinToMs("2026-07-03", "08:30")).toISOString(), "2026-07-03T06:30:00.000Z");
  assert.equal(fmtTime(ms), "08:30");
  assert.equal(dayKey(ms), "2026-11-03");
  assert.equal(weekdayOf("2026-11-02"), 0);
  assert.equal(mondayOf("2026-11-08"), "2026-11-02");
});

test("Angebote ohne Preis sind nicht buchbar", () => {
  const db = openDatabase(":memory:");
  const offers = listOffers(db);
  assert.ok(offers.some((o) => o.kind === "language" && isBookable(o)));
  assert.ok(offers.filter((o) => o.kind === "slot").every((o) => !isBookable(o)));
});

test("Ablauf: anfragen → bestätigen → andere automatisch abgelehnt → bezahlen", () => {
  const { db, a, b, slot, now } = setup();
  const ra = requestSlot(db, a.id, slot.id, "Bitte Abholung", now);
  const rb = requestSlot(db, b.id, slot.id, "", now);
  assert.throws(() => requestSlot(db, a.id, slot.id, "", now), BookingError);
  assert.equal(listOpenSlots(db, a.id, now, now + 30 * 24 * H, now)[0].myBooking?.id, ra.id);

  const { booking, autoDeclined } = confirmBooking(db, ra.id, "Bestätigt", "Vergeben", now);
  assert.equal(booking.status, "awaiting_payment");
  assert.equal(booking.payDeadline, now + 30 * 60_000);
  assert.equal(getSlot(db, slot.id)!.status, "reserved");
  assert.deepEqual(autoDeclined.map((x) => x.id), [rb.id]);
  assert.equal(getBooking(db, rb.id)!.status, "declined");
  assert.equal(listOpenSlots(db, b.id, now, now + 30 * 24 * H, now).length, 0);

  const paid = markPaid(db, ra.id, { provider: "test", paymentRef: "p1", amountCents: 6500 }, now + 10 * 60_000);
  assert.ok(paid.ok);
  assert.equal(getSlot(db, slot.id)!.status, "booked");
  // doppelt eintreffende Zahlungsbestätigung ist harmlos
  const again = markPaid(db, ra.id, { provider: "test", paymentRef: "p1", amountCents: 6500 });
  assert.ok(again.ok && again.already);
});

test("Falscher Betrag wird nicht akzeptiert", () => {
  const { db, a, slot, now } = setup();
  const r = requestSlot(db, a.id, slot.id, "", now);
  confirmBooking(db, r.id, "", "", now);
  const res = markPaid(db, r.id, { provider: "test", paymentRef: "x", amountCents: 100 }, now);
  assert.equal(res.ok, false);
});

test("30 Minuten ohne Zahlung → Termin wieder frei; spätere Zahlung nach Vergabe = Konflikt", () => {
  const { db, a, b, slot, now } = setup();
  const r = requestSlot(db, a.id, slot.id, "", now);
  confirmBooking(db, r.id, "", "", now);
  assert.equal(expireDue(db, now + 29 * 60_000).length, 0);
  const expired = expireDue(db, now + 31 * 60_000);
  assert.deepEqual(expired.map((x) => x.id), [r.id]);
  assert.equal(getSlot(db, slot.id)!.status, "open");

  const r2 = requestSlot(db, b.id, slot.id, "", now + 40 * 60_000);
  confirmBooking(db, r2.id, "", "", now + 41 * 60_000);
  const late = markPaid(db, r.id, { provider: "test", paymentRef: "late", amountCents: 6500 }, now + 42 * 60_000);
  assert.equal(late.ok, false);
  assert.equal(!late.ok && late.reason, "conflict");
});

test("Späte Zahlung, Termin noch frei → wird trotzdem gebucht", () => {
  const { db, a, slot, now } = setup();
  const r = requestSlot(db, a.id, slot.id, "", now);
  confirmBooking(db, r.id, "", "", now);
  expireDue(db, now + 31 * 60_000);
  const res = markPaid(db, r.id, { provider: "test", paymentRef: "p", amountCents: 6500 }, now + 32 * 60_000);
  assert.ok(res.ok);
  assert.equal(getSlot(db, slot.id)!.status, "booked");
});

test("Absage durch Schüler: bis 24 h vorher mit Rückzahlung, danach nicht", () => {
  const { db, a, slot, now, start } = setup();
  const r = requestSlot(db, a.id, slot.id, "", now);
  confirmBooking(db, r.id, "", "", now);
  markPaid(db, r.id, { provider: "test", paymentRef: "p", amountCents: 6500 }, now);
  assert.throws(() => cancelByStudent(db, a.id, r.id, start - 23 * H), BookingError);
  const res = cancelByStudent(db, a.id, r.id, start - 25 * H);
  assert.equal(res.refundCents, 6500);
  assert.equal(getSlot(db, slot.id)!.status, "open");
});

test("Absage durch Fahrschule mit eigenem Text; Termin bleibt zu", () => {
  const { db, a, slot, now } = setup();
  const r = requestSlot(db, a.id, slot.id, "", now);
  confirmBooking(db, r.id, "", "", now);
  markPaid(db, r.id, { provider: "test", paymentRef: "p", amountCents: 6500 }, now);
  const res = cancelByAdmin(db, r.id, { message: "Bin krank", refund: true, reopenSlot: false }, now);
  assert.equal(res.refundCents, 6500);
  assert.equal(res.booking.adminMessage, "Bin krank");
  assert.equal(getSlot(db, slot.id)!.status, "closed");
});

test("Ablehnen und Termin löschen lehnt offene Anfragen ab", () => {
  const { db, a, b, slot, now } = setup();
  const ra = requestSlot(db, a.id, slot.id, "", now);
  requestSlot(db, b.id, slot.id, "", now);
  assert.equal(declineBooking(db, ra.id, "Nein", now).status, "declined");
  const declined = closeSlot(db, slot.id, "Termin entfällt");
  assert.equal(declined.length, 1);
  assert.equal(getSlot(db, slot.id)!.status, "closed");
});

test("Überschneidende Termine werden übersprungen, zu kurzfristige nicht anfragbar", () => {
  const { db, a, offer, now, start } = setup();
  const r = createSlots(db, offer.id, [start + 30 * 60_000, start + 45 * 60_000], now);
  assert.equal(r.created.length, 1);
  assert.equal(r.skipped.length, 1);
  saveSettings(db, { minLeadHours: 72 });
  assert.throws(() => requestSlot(db, a.id, r.created[0].id, "", now), BookingError);
});

test("Sprachpaket online bezahlen setzt Paket auf bezahlt", () => {
  const { db, a, now } = setup();
  const pkg = bookPackage(db, a.id, "tr");
  const order = orderProduct(db, a.id, "sprachpaket", { packageId: pkg.id }, now);
  assert.equal(order.status, "awaiting_payment");
  assert.equal(orderProduct(db, a.id, "sprachpaket", { packageId: pkg.id }, now).id, order.id);
  assert.ok(markPaid(db, order.id, { provider: "test", paymentRef: "p", amountCents: 3000 }, now).ok);
  assert.equal(currentPackage(db, a.id)!.status, "paid");
});

import { createHmac } from "node:crypto";
import { formEncode, verifyWebhook } from "../src/lib/server/payments/stripe";

test("Stripe: Webhook-Signatur wird geprüft", () => {
  const body = JSON.stringify({ id: "evt_1" });
  const t = 1_800_000_000;
  const sig = createHmac("sha256", "whsec_test").update(`${t}.${body}`).digest("hex");
  assert.ok(verifyWebhook(body, `t=${t},v1=${sig}`, "whsec_test", 300, t + 10));
  assert.ok(!verifyWebhook(body + " ", `t=${t},v1=${sig}`, "whsec_test", 300, t + 10));
  assert.ok(!verifyWebhook(body, `t=${t},v1=${sig}`, "whsec_test", 300, t + 1000));
  assert.ok(!verifyWebhook(body, `t=${t},v1=${sig}`, "falsch", 300, t + 10));
});

test("Stripe: Formular-Kodierung", () => {
  const s = formEncode({ a: "1", line_items: [{ price_data: { unit_amount: "6500" } }], m: ["card", "klarna"] }).toString();
  assert.equal(decodeURIComponent(s), "a=1&line_items[0][price_data][unit_amount]=6500&m[0]=card&m[1]=klarna");
});
