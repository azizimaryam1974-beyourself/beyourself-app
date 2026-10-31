import { test } from "node:test";
import assert from "node:assert/strict";
import { moderateQuestion, quickCheck, shortName } from "../src/lib/moderation";

test("Wortliste: Beleidigungen blockiert, auch verschleiert", () => {
  assert.equal(quickCheck("Du A-r-s-c-h-l-o-c-h").allowed, false);
  assert.equal(quickCheck("f*ck this").allowed, true, "Sternchen-Varianten prüft Claude");
  assert.equal(quickCheck("FUUUCK").allowed, false);
  assert.equal(quickCheck("siktir git").allowed, false);
  assert.equal(quickCheck("сука").allowed, false);
  assert.equal(quickCheck("aaaaaaaaaaaa").allowed, false);
  assert.equal(quickCheck("schau www.spam.de").allowed, false);
});

test("Wortliste: echte Fragen bleiben erlaubt (keine falschen Sperren)", () => {
  for (const q of [
    "Darf ich auf einem Behindertenparkplatz kurz halten?",
    "Wer hat Vorfahrt bei rechts vor links?",
    "Bu kuralın huyu nedir?", // türk. „huy“ = Art/Charakter
    "ما معنى هذه العلامة؟",
    "Amina hat gefragt, ob die Prüfung schwer ist",
    "Was kostet die Prüfung beim TÜV?",
  ]) assert.equal(quickCheck(q).allowed, true, q);
});

test("Ohne Claude: nur Wortliste, Frage bleibt unverändert", async () => {
  const r = await moderateQuestion("Wie schnell darf ich auf der Landstraße fahren?");
  assert.deepEqual(r, { allowed: true, reason: "", lang: "?", german: "Wie schnell darf ich auf der Landstraße fahren?" });
});

test("Mit Claude: Übersetzung + Urteil; Fehler → zurückhalten", async () => {
  const fake = (body: unknown, ok = true) => (async () => new Response(JSON.stringify(body), { status: ok ? 200 : 500 })) as unknown as typeof fetch;
  const r = await moderateQuestion("Otoyolda ne kadar hızlı gidebilirim?", { apiKey: "k", fetchImpl: fake({ content: [{ type: "text", text: '{"lang":"tr","german":"Wie schnell darf ich auf der Autobahn fahren?","allowed":true,"reason":""}' }] }) });
  assert.equal(r.allowed, true);
  assert.equal(r.german, "Wie schnell darf ich auf der Autobahn fahren?");
  const bad = await moderateQuestion("lustiger Spruch über die Lehrerin", { apiKey: "k", fetchImpl: fake({ content: [{ type: "text", text: '{"lang":"de","german":"…","allowed":false,"reason":"Stört den Unterricht"}' }] }) });
  assert.equal(bad.allowed, false);
  const err = await moderateQuestion("Frage", { apiKey: "k", fetchImpl: fake({}, false) });
  assert.equal(err.allowed, false, "bei Fehler nicht automatisch zeigen");
});

test("Name auf dem Beamer: Vorname + Initial", () => {
  assert.equal(shortName("Lona Scholz"), "Lona S.");
  assert.equal(shortName("Ayşe Nur Yılmaz"), "Ayşe Y.");
  assert.equal(shortName("Cem"), "Cem");
});
