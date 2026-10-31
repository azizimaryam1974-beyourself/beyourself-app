import { test } from "node:test";
import assert from "node:assert/strict";
import { canBook, computeTraining, durationsFor, priceCents, DEFAULT_PRICES, type DriveRecord, type TrainingProfile } from "../src/lib/training";

const base: TrainingProfile = {
  licenseClass: "b197", practiceTarget: null, repeatTarget: 3, extraManual: 0,
  testfahrtPassedAt: null, examReadyAt: null, theoryPassedAt: null, pruefauftragAt: null,
};
const done = (kind: DriveRecord["kind"], minutes: number): DriveRecord => ({ kind, minutes, status: "done" });
const planned = (kind: DriveRecord["kind"], minutes: number): DriveRecord => ({ kind, minutes, status: "planned" });
const kinds = (s: ReturnType<typeof computeTraining>) => s.bookable.map((b) => [b.kind, b.durations]);

test("Preise anteilig zum 45-Minuten-Preis", () => {
  assert.equal(priceCents("schalter", 45), 6800);
  assert.equal(priceCents("schalter", 60), 9067);   // 90,67 €
  assert.equal(priceCents("schalter", 75), 11333);  // 113,33 €
  assert.equal(priceCents("schalter", 90), 13600);  // 136,00 €
  assert.equal(priceCents("ueberland", 60), 10000); // 100,00 €
  assert.equal(priceCents("ueberland", 75), 12500);
  assert.equal(priceCents("autobahn", 90), 15000);
  assert.equal(priceCents("beleuchtung", 135), 22500);
  assert.equal(priceCents("warmstunde", 30), 4500);
  assert.equal(priceCents("testfahrt", 30), 4500);
  assert.equal(priceCents("testfahrt", 45, { ...DEFAULT_PRICES, testfahrtMinutes: 45 }), 6800);
});

test("Längen: nur solche, nach denen der Rest aufgeht", () => {
  assert.deepEqual(durationsFor(null), [60, 75, 90]);
  assert.deepEqual(durationsFor(135), [60, 75]);         // 90 würde 45 übrig lassen
  assert.deepEqual(durationsFor(135, [60, 75, 90, 135]), [60, 75, 135]);
  assert.deepEqual(durationsFor(180), [60, 90]);         // 75 würde 105 übrig lassen – geht nicht auf
  assert.deepEqual(durationsFor(225), [60, 75, 90]);     // 5 Überlandstunden
  assert.deepEqual(durationsFor(45), [60]);              // Rest unter 60 → 60 erlaubt
  assert.deepEqual(durationsFor(0), []);
});

test("B197: Einstieg 3 Std. Automatik (135 Min)", () => {
  let s = computeTraining(base, []);
  assert.equal(s.current?.id, "einstieg");
  assert.deepEqual(kinds(s), [["automatik", [60, 75]]]);
  assert.equal(canBook(s, "schalter", 60).ok, false);
  assert.equal(canBook(s, "automatik", 90).ok, false);
  s = computeTraining(base, [done("automatik", 75)]);
  assert.deepEqual(kinds(s), [["automatik", [60]]]);
  s = computeTraining(base, [done("automatik", 75), planned("automatik", 60)]);
  assert.equal(s.bookable.length, 0, "alles gebucht");
});

test("B197: 10 Std. Schalter → Testfahrt → nicht bestanden bringt Zusatzstunden", () => {
  const recs = [done("automatik", 135), done("schalter", 450)];
  let s = computeTraining(base, recs);
  assert.equal(s.current?.id, "testfahrt");
  assert.deepEqual(kinds(s), [["testfahrt", [30]]]);
  assert.deepEqual(kinds(computeTraining(base, recs, { testfahrtMinutes: 45 })), [["testfahrt", [45]]]);
  s = computeTraining({ ...base, extraManual: 2 }, recs);
  assert.equal(s.current?.id, "schalter");
  assert.equal(s.bookable[0].remaining, 90);
});

test("Sonderfahrten: zuerst je mind. 90 Min Überland + Autobahn, dann alles frei, Beleuchtung bis 135", () => {
  const p = { ...base, testfahrtPassedAt: 1 };
  const pre = [done("automatik", 135), done("schalter", 450)];
  let s = computeTraining(p, pre);
  assert.equal(s.current?.id, "sonder");
  assert.deepEqual(kinds(s), [["ueberland", [90]], ["autobahn", [90]]]);
  assert.equal(canBook(s, "beleuchtung", 135).ok, false);
  s = computeTraining(p, [...pre, planned("ueberland", 90)]);
  assert.deepEqual(kinds(s), [["autobahn", [90]]]);
  s = computeTraining(p, [...pre, done("ueberland", 90), done("autobahn", 90)]);
  assert.deepEqual(kinds(s), [["ueberland", [60, 75]], ["autobahn", [90]], ["beleuchtung", [60, 75, 135]]]);
  // zwei kurze Fahrten ersetzen nicht die 90-Min-Einstiegsfahrt
  s = computeTraining(p, [...pre, done("ueberland", 60), done("ueberland", 60), done("autobahn", 90)]);
  assert.ok(!s.bookable.some((b) => b.kind === "beleuchtung"));
});

test("Nicht erschienen zählt nicht als gefahren", () => {
  const s = computeTraining(base, [done("automatik", 75), { kind: "automatik", minutes: 60, status: "no_show" }]);
  assert.equal(s.phases[0].counters[0].done, 75);
  assert.equal(s.current?.id, "einstieg");
});

test("B: Übungsfahrten ohne Zielzahl bleiben offen, Fahrlehrer legt Stunden fest", () => {
  const p: TrainingProfile = { ...base, licenseClass: "b" };
  let s = computeTraining(p, [done("schalter", 900)]);
  assert.equal(s.current?.id, "uebung");
  assert.deepEqual(kinds(s), [["schalter", [60, 75, 90]]]);
  s = computeTraining({ ...p, practiceTarget: 20 }, [done("schalter", 900)]);
  assert.equal(s.current?.id, "sonder");
});

test("B78 Automatik; Wiederholung mind. 3 Std., erhöhbar; Prüfung legt nur die Fahrschule fest", () => {
  const p: TrainingProfile = { ...base, licenseClass: "b78", practiceTarget: 10 };
  const all = [done("automatik", 450), done("ueberland", 90), done("ueberland", 135), done("autobahn", 90), done("autobahn", 90), done("beleuchtung", 135)];
  let s = computeTraining(p, all);
  assert.equal(s.current?.id, "wiederholung");
  assert.deepEqual(kinds(s), [["wiederholung", [60, 75]]]);
  s = computeTraining({ ...p, repeatTarget: 1 }, [...all, done("wiederholung", 135)]);
  assert.equal(s.current?.id, "reife", "unter 3 nicht einstellbar");
  s = computeTraining({ ...p, repeatTarget: 6 }, [...all, done("wiederholung", 135)]);
  assert.equal(s.current?.id, "wiederholung");
  s = computeTraining({ ...p, examReadyAt: 1 }, [...all, done("wiederholung", 135)]);
  assert.equal(s.current?.id, "pruefung");
  assert.equal(s.bookable.length, 0);
});

test("Umschreibung: keine Sonderfahrten", () => {
  const p: TrainingProfile = { ...base, licenseClass: "umschreibung", practiceTarget: 4 };
  const s = computeTraining(p, [done("schalter", 180)]);
  assert.equal(s.current?.id, "wiederholung");
  assert.ok(!s.phases.some((ph) => ph.id === "sonder"));
});
