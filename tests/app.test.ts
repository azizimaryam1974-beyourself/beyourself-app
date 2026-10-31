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
  name: "Ayşe Yılmaz", email: "ayse@example.de", phone: "", password: "geheim12345", licenseClass: "b197",
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

// ---------- Claude-Übersetzer ----------
import { ClaudeTranslator, parseTranslations } from "../src/lib/translation/claude-translator";
import { FallbackTranslator } from "../src/lib/translation/fallback";

test("Claude: eine Anfrage für alle Sprachen, Fachbegriffe + Kontext im Prompt", async () => {
  const calls: { url: string; body: any; headers: Record<string, string> }[] = [];
  const fakeFetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, body: JSON.parse(String(init.body)), headers: init.headers as Record<string, string> });
    return new Response(JSON.stringify({ content: [{ type: "text", text: '```json\n{"tr":"Sağdan gelenin önceliği geçerlidir.","ru":"Действует помеха справа.","fa":"حق تقدم با سمت راست است."}\n```' }] }), { status: 200 });
  }) as unknown as typeof fetch;
  const t = new ClaudeTranslator({ apiKey: "sk-test", fetchImpl: fakeFetch });
  const out = await t.translate("Hier gilt rechts vor links.", ["tr", "ru", "fa"], { context: ["Wir sind an einer Kreuzung."] });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://api.anthropic.com/v1/messages");
  assert.equal(calls[0].headers["x-api-key"], "sk-test");
  assert.equal(calls[0].body.model, "claude-haiku-5-5");
  const msg = calls[0].body.messages[0].content as string;
  assert.match(msg, /rechts vor links" → tr: sağdan gelenin önceliği \| ru: помеха справа \| fa: حق تقدم با سمت راست/);
  assert.match(msg, /Wir sind an einer Kreuzung/);
  assert.doesNotMatch(msg, /Rettungsgasse/, "nur passende Fachbegriffe");
  assert.equal(out.ru, "Действует помеха справа.");
});

test("Claude: kaputte Antwort -> Fehler; fehlende Sprachen werden weggelassen", () => {
  assert.throws(() => parseTranslations("Entschuldigung", ["tr"]));
  assert.deepEqual(parseTranslations('{"tr":"a","xx":"b","ru":""}', ["tr", "ru"]), { tr: "a" });
});

test("Fallback: Claude fällt aus oder lässt Sprache weg -> Azure übernimmt", async () => {
  const azure = new MockTranslator();
  const down = new FallbackTranslator({ name: "claude", translate: async () => { throw new Error("529 overloaded"); } }, azure);
  assert.deepEqual(await down.translate("Satz.", ["tr", "ar"]), { tr: "[TR] Satz.", ar: "[AR] Satz." });
  const partial = new FallbackTranslator({ name: "claude", translate: async () => ({ tr: "cümle" }) }, azure);
  assert.deepEqual(await partial.translate("Satz.", ["tr", "ar"]), { tr: "cümle", ar: "[AR] Satz." });
  assert.deepEqual(azure.calls.at(-1)!.targets, ["ar"]);
});

test("LiveHub gibt die letzten Sätze als Kontext mit", async () => {
  const seen: (string[] | undefined)[] = [];
  const hub = new LiveHub({ translator: { name: "x", translate: async (t, _l, o) => { seen.push(o?.context); return { en: t }; } } });
  hub.subscribe("k", { id: "a", userId: "u", language: "en", send: () => {} });
  for (const s of ["eins", "zwei", "drei", "vier", "fünf"]) await hub.publish("k", s);
  assert.deepEqual(seen[0], []);
  assert.deepEqual(seen[4], ["zwei", "drei", "vier"]);
});

// ---------- Sicherheit & DSGVO ----------
import { RateLimiter } from "../src/lib/server/rate-limit";
import {
  createPasswordReset, completePasswordReset, userForPasswordReset, purgeOldSegments,
  exportPersonalData, deleteStudent, setLessonStatus, findUserByEmail,
} from "../src/lib/server/repo";

test("Login-Schutz: nach 5 Fehlversuchen gesperrt, nach Ablauf wieder frei", () => {
  let now = 0;
  const l = new RateLimiter(5, 15 * 60_000, () => now);
  for (let i = 0; i < 4; i++) l.fail("a@b.de");
  assert.equal(l.blockedFor("a@b.de"), 0);
  l.fail("a@b.de");
  assert.ok(l.blockedFor("a@b.de") > 0);
  assert.equal(l.blockedFor("andere@b.de"), 0);
  now = 15 * 60_000 + 1;
  assert.equal(l.blockedFor("a@b.de"), 0);
});

test("Passwort-Link: einmalig, läuft ab, beendet alte Anmeldungen", () => {
  const db = openDatabase(":memory:");
  const u = createUser(db, { email: "p@b.de", name: "P", passwordHash: "alt", role: "student" });
  insertAuthSession(db, hashToken("sitzung"), u.id, Date.now() + 60_000);
  createPasswordReset(db, hashToken("link1"), u.id, "lehrer", 60_000);
  createPasswordReset(db, hashToken("link2"), u.id, "lehrer", 60_000);
  assert.equal(userForPasswordReset(db, hashToken("link1")), undefined, "älterer Link ungültig");
  assert.equal(completePasswordReset(db, hashToken("link2"), "neu")!.id, u.id);
  assert.equal(completePasswordReset(db, hashToken("link2"), "nochmal"), undefined, "nur einmal");
  assert.equal(findUserByEmail(db, "p@b.de")!.password_hash, "neu");
  assert.equal(userForSession(db, hashToken("sitzung")), undefined, "alte Anmeldung beendet");
  createPasswordReset(db, hashToken("abgelaufen"), u.id, "lehrer", -1);
  assert.equal(userForPasswordReset(db, hashToken("abgelaufen")), undefined);
});

test("Löschfrist: nur Sätze alter, beendeter Stunden werden gelöscht", () => {
  const db = openDatabase(":memory:");
  const t = createUser(db, { email: "t@b.de", name: "T", passwordHash: "x", role: "teacher" });
  const alt = createLesson(db, "alt", t.id), neu = createLesson(db, "neu", t.id), live = createLesson(db, "live", t.id);
  for (const l of [alt, neu, live]) saveSegment(db, { sessionId: l.id, seq: 1, original: "Satz", translations: {}, at: new Date().toISOString() });
  setLessonStatus(db, alt.id, "ended");
  db.prepare(`UPDATE lessons SET ended_at = ? WHERE id = ?`).run(new Date(Date.now() - 200 * 864e5).toISOString(), alt.id);
  setLessonStatus(db, neu.id, "ended");
  setLessonStatus(db, live.id, "live");
  assert.equal(purgeOldSegments(db, 180), 1);
  assert.equal(listSegments(db, alt.id).length, 0);
  assert.equal(listSegments(db, neu.id).length, 1);
  assert.equal(listSegments(db, live.id).length, 1);
});

test("DSGVO: Auskunft enthält Konto + Paket; Löschen anonymisiert, Buchung bleibt", () => {
  const db = openDatabase(":memory:");
  const u = createUser(db, { email: "s@b.de", name: "Sara", phone: "0170", passwordHash: "x", role: "student" });
  bookPackage(db, u.id, "fa");
  const ex = exportPersonalData(db, u.id)!;
  assert.equal(ex.account.email, "s@b.de");
  assert.equal(ex.languagePackages[0].language, "fa");
  assert.ok(!JSON.stringify(ex).includes("password"));
  assert.equal(deleteStudent(db, u.id), true);
  assert.equal(findUserByEmail(db, "s@b.de"), undefined);
  assert.equal(listStudents(db).length, 0);
  const pkg = db.prepare(`SELECT * FROM language_packages WHERE user_id = ?`).get(u.id) as { price_cents: number };
  assert.equal(pkg.price_cents, 3000, "Buchung bleibt für die Buchhaltung");
  const t = createUser(db, { email: "t@b.de", name: "T", passwordHash: "x", role: "teacher" });
  assert.equal(deleteStudent(db, t.id), false, "Lehrkräfte nicht über diese Funktion löschbar");
});

// ---------- Vorlesen ----------
import { buildSsml, escapeXml } from "../src/components/tts";

test("Vorlesen: SSML mit richtiger Sprache, Sonderzeichen sicher", () => {
  assert.equal(escapeXml(`a<b>&"c'`), "a&lt;b&gt;&amp;&quot;c&apos;");
  assert.equal(
    buildSsml("Priorité à droite <ok>", "fr-FR-DeniseNeural"),
    '<speak version="1.0" xml:lang="fr-FR"><voice name="fr-FR-DeniseNeural">Priorité à droite &lt;ok&gt;</voice></speak>',
  );
  assert.match(buildSsml("x", "ar-SA-ZariyahNeural"), /xml:lang="ar-SA"/);
});
