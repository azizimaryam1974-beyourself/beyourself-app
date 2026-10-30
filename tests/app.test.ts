import { test } from "node:test";
import assert from "node:assert/strict";
import { openDatabase } from "../src/lib/server/db";
import { hashPassword, verifyPassword, hashToken } from "../src/lib/server/password";
import {
  bookPackage, createLesson, createUser, currentPackage, insertAuthSession, lastSeq, listSegments,
  listStudents, PackageAlreadyBookedError, saveSegment, setPackageStatus, userForSession,
} from "../src/lib/server/repo";
import { validateSignup, type SignupInput } from "../src/lib/signup";
import { bookableLanguages } from "../src/lib/languages";
import { hasTranslationAccess } from "../src/lib/language-package";
import { LiveHub } from "../src/lib/live-hub";
import { MockTranslator } from "../src/lib/translation/mock";

const base: SignupInput = {
  name: "Ayşe Yılmaz", email: "ayse@example.de", phone: "", password: "geheim12345",
  wantsPackage: true, language: "tr", acceptPrivacy: true, acceptPackageTerms: true,
};

test("Anmeldung: gültig mit Paket", () => {
  const r = validateSignup(base);
  assert.ok(r.ok);
  assert.equal(r.ok && r.value.language, "tr");
});

test("Anmeldung: ohne Paket braucht keine Sprache und keine Paket-Bestätigung", () => {
  const r = validateSignup({ ...base, wantsPackage: false, language: null, acceptPackageTerms: false });
  assert.ok(r.ok);
  assert.equal(r.ok && r.value.language, null);
});

test("Anmeldung: Fehler je Feld", () => {
  const r = validateSignup({ ...base, email: "x", password: "kurz", acceptPrivacy: false, acceptPackageTerms: false, language: "fa" });
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.ok(r.errors.email && r.errors.password && r.errors.acceptPrivacy && r.errors.acceptPackageTerms && r.errors.language);
  }
});

test("Farsi per ENABLE_FARSI zuschaltbar", () => {
  process.env.ENABLE_FARSI = "1";
  try {
    assert.ok(bookableLanguages().some((l) => l.code === "fa"));
    assert.equal(validateSignup({ ...base, language: "fa" }).ok, true);
  } finally {
    delete process.env.ENABLE_FARSI;
  }
  assert.ok(!bookableLanguages().some((l) => l.code === "fa"));
});

test("Passwort-Hash", async () => {
  const h = await hashPassword("geheim12345");
  assert.ok(await verifyPassword("geheim12345", h));
  assert.equal(await verifyPassword("falsch", h), false);
  assert.equal(await verifyPassword("x", "kaputt"), false);
});

test("Datenbank: Konto, Paket 30 €, kein Doppelpaket, Status", () => {
  const db = openDatabase(":memory:");
  const u = createUser(db, { email: "A@B.de", name: "A", passwordHash: "x", role: "student" });
  assert.equal(u.email, "a@b.de");
  assert.throws(() => createUser(db, { email: "a@b.de", name: "B", passwordHash: "x", role: "student" }));

  const p = bookPackage(db, u.id, "ar");
  assert.equal(p.priceCents, 3000);
  assert.equal(p.status, "booked");
  assert.ok(hasTranslationAccess(p));
  assert.throws(() => bookPackage(db, u.id, "en"), PackageAlreadyBookedError);

  setPackageStatus(db, p.id, "paid");
  assert.equal(currentPackage(db, u.id)!.status, "paid");
  assert.ok(currentPackage(db, u.id)!.paidAt);

  setPackageStatus(db, p.id, "cancelled");
  assert.equal(hasTranslationAccess(currentPackage(db, u.id)), false);
  // nach Storno neu buchbar
  const p2 = bookPackage(db, u.id, "en");
  assert.equal(currentPackage(db, u.id)!.id, p2.id);
  assert.equal(listStudents(db)[0].pkg!.language, "en");
});

test("Datenbank: Login-Sitzung läuft ab", () => {
  const db = openDatabase(":memory:");
  const u = createUser(db, { email: "s@b.de", name: "S", passwordHash: "x", role: "student" });
  insertAuthSession(db, hashToken("gut"), u.id, Date.now() + 60_000);
  insertAuthSession(db, hashToken("alt"), u.id, Date.now() - 1);
  assert.equal(userForSession(db, hashToken("gut"))!.id, u.id);
  assert.equal(userForSession(db, hashToken("alt")), undefined);
});

test("Satznummern laufen nach Neustart weiter (nichts wird überschrieben)", async () => {
  const db = openDatabase(":memory:");
  const t = createUser(db, { email: "t@b.de", name: "T", passwordHash: "x", role: "teacher" });
  const l = createLesson(db, "Vorfahrt", t.id);
  const mk = () => new LiveHub({ translator: new MockTranslator(), persist: (s) => saveSegment(db, s), initialSeq: (id) => lastSeq(db, id) });

  const hub1 = mk();
  hub1.subscribe(l.id, { id: "x", userId: "u", language: "tr", send: () => {} });
  await hub1.publish(l.id, "Eins.");
  await hub1.publish(l.id, "Zwei.");

  const hub2 = mk(); // "Neustart"
  await hub2.publish(l.id, "Drei.");
  const segs = listSegments(db, l.id);
  assert.deepEqual(segs.map((s) => [s.seq, s.original]), [[1, "Eins."], [2, "Zwei."], [3, "Drei."]]);
  assert.equal(segs[0].translations.tr, "[TR] Eins.");
});
