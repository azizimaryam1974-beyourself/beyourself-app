import { test } from "node:test";
import assert from "node:assert/strict";
import { openDatabase } from "../src/lib/server/db";
import { createUser } from "../src/lib/server/repo";
import { addressLine, detailsMissing, getDetails, saveDetails, setPhone, setPhoto, upcomingBirthdays } from "../src/lib/server/user-details";

test("Angaben: fehlen erst, dann vollständig; Geburtstage der nächsten Tage", () => {
  const db = openDatabase(":memory:");
  const u = createUser(db, { email: "a@b.de", name: "Lona Scholz", passwordHash: "x", role: "student" });
  assert.equal(detailsMissing(db, { id: u.id, phone: null }), true);
  saveDetails(db, u.id, { birthday: "2005-11-03", street: "Königsplatz 1", zip: "34117", city: "Kassel" });
  setPhone(db, u.id, "0561 123456");
  assert.equal(detailsMissing(db, { id: u.id, phone: "0561 123456" }), false);
  assert.equal(addressLine(getDetails(db, u.id)), "Königsplatz 1, 34117 Kassel");
  const b = upcomingBirthdays(db, "2026-11-01", 7);
  assert.equal(b.length, 1);
  assert.equal(b[0].inDays, 2);
  assert.equal(b[0].age, 21);
  assert.equal(upcomingBirthdays(db, "2026-11-04", 7).length, 0);
  assert.equal(upcomingBirthdays(db, "2026-11-03", 0)[0].age, 21);
  assert.equal(setPhoto(db, u.id, "avatars/x.jpg"), null);
  assert.equal(setPhoto(db, u.id, null), "avatars/x.jpg");
  assert.equal(getDetails(db, u.id).birthday, "2005-11-03"); // Foto ändern lässt Angaben stehen
});

import { addDoc, docsToCheck, hasIdDocument, listDocs, removeDoc, setDocStatus } from "../src/lib/server/student-docs";

test("Unterlagen: Ausweis zählt, solange er nicht abgelehnt ist", () => {
  const db = openDatabase(":memory:");
  const u = createUser(db, { email: "c@d.de", name: "Ali Test", passwordHash: "x", role: "student" });
  assert.equal(hasIdDocument(db, u.id), false);
  const a = addDoc(db, { userId: u.id, type: "ausweis", path: "unterlagen/a.jpg", name: "a.jpg", fileType: "image/jpeg", size: 10 });
  assert.equal(hasIdDocument(db, u.id), true);
  assert.equal(docsToCheck(db)[0].count, 1);
  setDocStatus(db, a.id, "abgelehnt", "unscharf");
  assert.equal(hasIdDocument(db, u.id), false);
  assert.equal(listDocs(db, u.id)[0].note, "unscharf");
  assert.equal(docsToCheck(db).length, 0);
  assert.equal(removeDoc(db, a.id), "unterlagen/a.jpg");
  assert.equal(listDocs(db, u.id).length, 0);
});

import { berlinToMs } from "../src/lib/time";
import { addCredit, creditBalance } from "../src/lib/server/credit";
import { filterMoney, moneyEntries, sumMoney } from "../src/lib/server/finance";
import { applyShift, fillShiftText, planShift, ShiftError } from "../src/lib/server/shift-day";

test("Finanzen: Einzahlung zählt als Einnahme, Auszahlung zieht ab, Summe stimmt", () => {
  const db = openDatabase(":memory:");
  const u = createUser(db, { email: "g@h.de", name: "Geld Test", passwordHash: "x", role: "student" });
  addCredit(db, { userId: u.id, amountCents: 75000, reason: "deposit", note: "Überweisung" });
  addCredit(db, { userId: u.id, amountCents: -5000, reason: "payout" });
  addCredit(db, { userId: u.id, amountCents: 2000, reason: "manual" });
  assert.equal(creditBalance(db, u.id), 72000);
  const e = filterMoney(moneyEntries(db), { kind: "einnahme" });
  assert.equal(e.length, 2); // Gutschrift (geschenkt) ist keine Einnahme
  assert.equal(sumMoney(e).total, 70000);
});

test("Tag verschieben: alle ab Uhrzeit, Überschneidung wird verhindert", () => {
  const db = openDatabase(":memory:");
  const u = createUser(db, { email: "s@h.de", name: "Sina Schieb", passwordHash: "x", role: "student" });
  const day = "2030-03-04";
  const offer = (db.prepare(`SELECT id FROM offers LIMIT 1`).get() as { id: string }).id;
  const mk = (id: string, h: string, m = 90) => {
    const s = berlinToMs(day, h);
    db.prepare(`INSERT INTO slots (id, offer_id, starts_at, ends_at, status, created_at) VALUES (?,?,?,?,'booked',0)`).run(id, offer, s, s + m * 60_000);
    db.prepare(`INSERT INTO bookings (id,user_id,offer_id,slot_id,title,price_cents,status,created_at) VALUES (?,?,?,?,?,?,'paid',0)`).run(`b${id}`, u.id, offer, id, "Fahrt", 6000);
  };
  mk("s1", "09:00"); mk("s2", "11:00"); mk("s3", "13:00");
  const plan = planShift(db, day, 11 * 60, 30);
  assert.equal(plan.length, 2);
  applyShift(db, plan);
  assert.equal((db.prepare(`SELECT starts_at FROM slots WHERE id='s2'`).get() as { starts_at: number }).starts_at, berlinToMs(day, "11:30"));
  assert.equal(fillShiftText("{name}: {alt}→{neu} ({minuten})", plan[0], 30), "Sina: 11:00→11:30 (30)");
  assert.throws(() => planShift(db, day, 13 * 60, -60), ShiftError); // nur 13:30 → 12:30 würde in 11:30–13:00 fallen
});
