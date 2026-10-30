import { test } from "node:test";
import assert from "node:assert/strict";
import { validateSignupChoice, hasTranslationAccess, formatPrice, LANGUAGE_PACKAGE_PRICE_CENTS } from "../src/lib/language-package";
import { bookableLanguages, isBookableLanguage } from "../src/lib/languages";
import { applyGlossary, recognitionPhrases } from "../src/lib/glossary";
import { AzureTranslator } from "../src/lib/translation/azure-translator";
import { MockTranslator } from "../src/lib/translation/mock";
import { LiveHub, type CaptionEvent } from "../src/lib/live-hub";
import { createSpeechTokenCache } from "../src/lib/azure-speech-token";

test("Sprachpaket kostet 30 €", () => {
  assert.equal(LANGUAGE_PACKAGE_PRICE_CENTS, 3000);
  assert.match(formatPrice(3000), /30,00\s€/);
});

test("Buchbare Sprachen: 5 aktiv, Farsi vorbereitet aber aus", () => {
  assert.deepEqual(bookableLanguages().map((l) => l.code), ["tr", "en", "ru", "ar", "es"]);
  assert.equal(isBookableLanguage("fa"), false);
  assert.equal(isBookableLanguage("tr"), true);
});

test("Anmeldung: Paket nur mit gültiger Sprache", () => {
  assert.deepEqual(validateSignupChoice({ wantsPackage: false }), { ok: true, value: null });
  assert.equal(validateSignupChoice({ wantsPackage: true }).ok, false);
  assert.equal(validateSignupChoice({ wantsPackage: true, language: "xx" }).ok, false);
  assert.equal(validateSignupChoice({ wantsPackage: true, language: "fa" }).ok, false);
  assert.deepEqual(validateSignupChoice({ wantsPackage: true, language: "ar" }), { ok: true, value: { language: "ar" } });
});

test("Zugriff auf Übersetzung nur mit gebuchtem/bezahltem Paket", () => {
  assert.equal(hasTranslationAccess(null), false);
  assert.equal(hasTranslationAccess({ status: "booked" }), true);
  assert.equal(hasTranslationAccess({ status: "paid" }), true);
  assert.equal(hasTranslationAccess({ status: "cancelled" }), false);
});

test("Fachbegriffe: Markup nur bei Treffer, längster Begriff gewinnt", () => {
  const r = applyGlossary("Hier gilt rechts vor links und Vorfahrt gewähren.", "en");
  assert.equal(r.changed, true);
  assert.equal(
    r.text,
    'Hier gilt <mstrans:dictionary translation="priority to the right">rechts vor links</mstrans:dictionary> und <mstrans:dictionary translation="give way">Vorfahrt gewähren</mstrans:dictionary>.',
  );
  assert.deepEqual(applyGlossary("Guten Abend zusammen", "en"), { text: "Guten Abend zusammen", changed: false });
  // Türkisch hat jetzt ebenfalls einen festen Begriff
  assert.match(applyGlossary("rechts vor links", "tr").text, /sağdan gelenin önceliği/);
  // Kein Treffer mitten im Wort
  assert.equal(applyGlossary("Bremswegberechnung", "en").changed, false);
  assert.ok(recognitionPhrases().includes("Rettungsgasse"));
});

test("Azure Translator: richtige Anfrage, EU-Endpunkt, Glossar getrennt", async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const fakeFetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const to = new URL(url).searchParams.getAll("to");
    return new Response(JSON.stringify([{ translations: to.map((t) => ({ to: t, text: `${t}:ok` })) }]), { status: 200 });
  }) as unknown as typeof fetch;

  const t = new AzureTranslator({ key: "k", region: "germanywestcentral", fetchImpl: fakeFetch, glossary: [{ de: "Schulterblick", translations: { en: "shoulder check" } }] });
  const out = await t.translate("Achte auf den Schulterblick.", ["tr", "en", "ar"]);
  assert.deepEqual(out, { tr: "tr:ok", ar: "ar:ok", en: "en:ok" });
  assert.equal(calls.length, 2, "eine gemeinsame Anfrage + eine Glossar-Anfrage für en");
  const shared = new URL(calls[0].url);
  assert.equal(shared.origin, "https://api-eur.cognitive.microsofttranslator.com");
  assert.equal(shared.searchParams.get("from"), "de");
  assert.deepEqual(shared.searchParams.getAll("to"), ["tr", "ar"]);
  const headers = calls[0].init.headers as Record<string, string>;
  assert.equal(headers["Ocp-Apim-Subscription-Key"], "k");
  assert.equal(headers["Ocp-Apim-Subscription-Region"], "germanywestcentral");
  assert.match(String(calls[1].init.body), /mstrans:dictionary translation=\\"shoulder check\\"/);
});

test("Azure Translator: Fehler wird gemeldet", async () => {
  const fakeFetch = (async () => new Response("quota", { status: 429 })) as unknown as typeof fetch;
  const t = new AzureTranslator({ key: "k", region: "r", fetchImpl: fakeFetch });
  await assert.rejects(t.translate("Hallo", ["en"]), /429/);
});

function collect() {
  const events: CaptionEvent[] = [];
  return { events, send: (e: { type: string; data: unknown }) => e.type === "caption" && events.push(e.data as CaptionEvent) };
}

test("LiveHub: jeder bekommt seine Sprache, nur benötigte Sprachen werden übersetzt", async () => {
  const mock = new MockTranslator();
  const stored: unknown[] = [];
  const hub = new LiveHub({ translator: mock, persist: (s) => void stored.push(s) });
  const a = collect(), b = collect(), admin = collect();
  hub.subscribe("s1", { id: "a", userId: "u1", language: "tr", send: a.send });
  hub.subscribe("s1", { id: "b", userId: "u2", language: "ar", send: b.send });
  hub.subscribe("s1", { id: "m", userId: "maryam", language: null, send: admin.send });
  hub.setLive("s1", true);
  await hub.publish("s1", "Heute geht es um Vorfahrt.");
  await hub.publish("s1", "   ");
  await hub.publish("s1", "Zweiter Satz.");

  assert.deepEqual(mock.calls[0].targets.sort(), ["ar", "tr"]);
  assert.equal(a.events[0].text, "[TR] Heute geht es um Vorfahrt.");
  assert.equal(b.events[0].text, "[AR] Heute geht es um Vorfahrt.");
  assert.equal(admin.events[0].text, "Heute geht es um Vorfahrt.");
  assert.deepEqual(a.events.map((e) => e.seq), [1, 2]);
  assert.equal(stored.length, 2);
});

test("LiveHub: ohne Zuhörer mit Sprache keine Kosten", async () => {
  const mock = new MockTranslator();
  const hub = new LiveHub({ translator: mock });
  const admin = collect();
  hub.subscribe("s2", { id: "m", userId: "maryam", language: null, send: admin.send });
  await hub.publish("s2", "Nur Deutsch.");
  assert.equal(mock.calls.length, 0);
  assert.equal(admin.events.length, 1);
});

test("LiveHub: Übersetzungsfehler -> Original bleibt, Fehlerhinweis", async () => {
  const hub = new LiveHub({ translator: { name: "x", translate: async () => { throw new Error("down"); } } });
  const a = collect();
  hub.subscribe("s3", { id: "a", userId: "u1", language: "ru", send: a.send });
  await hub.publish("s3", "Satz.");
  assert.equal(a.events[0].text, null);
  assert.equal(a.events[0].original, "Satz.");
  assert.ok(a.events[0].error);
});

test("LiveHub: Reihenfolge bleibt trotz unterschiedlich langer Übersetzung", async () => {
  let n = 0;
  const hub = new LiveHub({
    translator: {
      name: "slow",
      translate: async (text) => {
        await new Promise((r) => setTimeout(r, n++ === 0 ? 30 : 1));
        return { en: text };
      },
    },
  });
  const a = collect();
  hub.subscribe("s4", { id: "a", userId: "u", language: "en", send: a.send });
  await Promise.all([hub.publish("s4", "eins"), hub.publish("s4", "zwei")]);
  assert.deepEqual(a.events.map((e) => e.text), ["eins", "zwei"]);
});

test("Speech-Token wird gecacht", async () => {
  let calls = 0;
  const fakeFetch = (async () => { calls++; return new Response("tok", { status: 200 }); }) as unknown as typeof fetch;
  const get = createSpeechTokenCache({ key: "k", region: "germanywestcentral", fetchImpl: fakeFetch });
  const [t1, t2] = await Promise.all([get(), get()]);
  await get();
  assert.equal(t1.token, "tok");
  assert.equal(t2.region, "germanywestcentral");
  assert.equal(calls, 1);
});
