import { test } from "node:test";
import assert from "node:assert/strict";
import { canBook, computeTraining, type DriveRecord, type TrainingProfile } from "../src/lib/training";

const base: TrainingProfile = {
  licenseClass: "b197", practiceTarget: null, repeatTarget: 3, extraManual: 0,
  testfahrtPassedAt: null, examReadyAt: null, theoryPassedAt: null, pruefauftragAt: null,
};
const done = (kind: DriveRecord["kind"], units: number): DriveRecord => ({ kind, units, status: "done" });
const planned = (kind: DriveRecord["kind"], units: number): DriveRecord => ({ kind, units, status: "planned" });

test("B197: Start nur Automatik in 90-Min-Blöcken", () => {
  const s = computeTraining(base, []);
  assert.equal(s.current?.id, "einstieg");
  assert.deepEqual(s.bookable, [{ kind: "automatik", sizes: [2], remaining: 3 }]);
  assert.equal(canBook(s, "schalter", 2).ok, false);
  assert.equal(canBook(s, "automatik", 1).ok, false);
});

test("B197: letzte Automatik-Stunde einzeln, gebuchte zählen mit", () => {
  const s = computeTraining(base, [done("automatik", 2)]);
  assert.deepEqual(s.bookable, [{ kind: "automatik", sizes: [1], remaining: 1 }]);
  const s2 = computeTraining(base, [done("automatik", 2), planned("automatik", 1)]);
  assert.equal(s2.bookable.length, 0);
});

test("B197: Schalter → Testfahrt → nicht bestanden bringt Zusatzstunden", () => {
  const recs = [done("automatik", 3), done("schalter", 10)];
  let s = computeTraining(base, recs);
  assert.equal(s.current?.id, "testfahrt");
  assert.ok(canBook(s, "testfahrt", 1).ok);
  s = computeTraining({ ...base, extraManual: 2 }, recs);
  assert.equal(s.current?.id, "schalter");
  assert.deepEqual(s.bookable[0], { kind: "schalter", sizes: [2], remaining: 2 });
});

test("Sonderfahrten: erst 90 Min Überland + Autobahn, Beleuchtung danach, dann einzeln", () => {
  const p = { ...base, testfahrtPassedAt: 1 };
  const pre = [done("automatik", 3), done("schalter", 10)];
  let s = computeTraining(p, pre);
  assert.equal(s.current?.id, "sonder");
  assert.deepEqual(s.bookable.map((b) => [b.kind, b.sizes]), [["ueberland", [2]], ["autobahn", [2]]]);
  assert.equal(canBook(s, "beleuchtung", 2).ok, false);
  // Überland-Block gebucht → nur noch Autobahn-Block möglich
  s = computeTraining(p, [...pre, planned("ueberland", 2)]);
  assert.deepEqual(s.bookable.map((b) => b.kind), ["autobahn"]);
  // beide gefahren → alles frei, auch einzeln
  s = computeTraining(p, [...pre, done("ueberland", 2), done("autobahn", 2)]);
  assert.deepEqual(s.bookable.map((b) => [b.kind, b.sizes]), [["ueberland", [1, 2]], ["autobahn", [1, 2]], ["beleuchtung", [1, 2]]]);
  // zwei einzelne 45-Min-Fahrten zählen NICHT als 90-Min-Einstieg
  s = computeTraining(p, [...pre, done("ueberland", 1), done("ueberland", 1), done("autobahn", 2)]);
  assert.ok(!s.bookable.some((b) => b.kind === "beleuchtung"));
});

test("Nicht erschienen zählt nicht als gefahren", () => {
  const s = computeTraining(base, [done("automatik", 2), { kind: "automatik", units: 1, status: "no_show" }]);
  assert.equal(s.phases[0].counters[0].done, 2);
  assert.equal(s.current?.id, "einstieg");
});

test("B: Übungsfahrten ohne Zielzahl bleiben offen, Fahrlehrer legt fest", () => {
  const p: TrainingProfile = { ...base, licenseClass: "b" };
  let s = computeTraining(p, [done("schalter", 20)]);
  assert.equal(s.current?.id, "uebung");
  assert.deepEqual(s.bookable, [{ kind: "schalter", sizes: [2], remaining: null }]);
  s = computeTraining({ ...p, practiceTarget: 20 }, [done("schalter", 20)]);
  assert.equal(s.current?.id, "sonder");
});

test("B78 fährt Automatik; Wiederholung mind. 3, erhöhbar; Reife durch Fahrlehrer", () => {
  const p: TrainingProfile = { ...base, licenseClass: "b78", practiceTarget: 10 };
  const all = [done("automatik", 10), done("ueberland", 2), done("ueberland", 3), done("autobahn", 2), done("autobahn", 2), done("beleuchtung", 3)];
  let s = computeTraining(p, all);
  assert.equal(s.current?.id, "wiederholung");
  assert.equal(s.bookable[0].kind, "wiederholung");
  s = computeTraining({ ...p, repeatTarget: 1 }, [...all, done("wiederholung", 3)]);
  assert.equal(s.current?.id, "reife", "unter 3 nicht einstellbar");
  s = computeTraining({ ...p, repeatTarget: 6 }, [...all, done("wiederholung", 3)]);
  assert.equal(s.current?.id, "wiederholung");
  s = computeTraining({ ...p, examReadyAt: 1 }, [...all, done("wiederholung", 3)]);
  assert.equal(s.current?.id, "pruefung");
  assert.equal(s.bookable.length, 0, "Prüfung legt nur die Fahrschule fest");
});

test("Umschreibung: keine Sonderfahrten", () => {
  const p: TrainingProfile = { ...base, licenseClass: "umschreibung", practiceTarget: 4 };
  const s = computeTraining(p, [done("schalter", 4)]);
  assert.equal(s.current?.id, "wiederholung");
  assert.ok(!s.phases.some((ph) => ph.id === "sonder"));
});
