import { test } from "node:test";
import assert from "node:assert/strict";
import { openDatabase } from "../src/lib/server/db";
import { createLesson, createUser, getLesson } from "../src/lib/server/repo";
import {
  addQuestion, mayParticipate, qaViewFor, raiseHand, scheduleLessons, setBeamer, setMuted, setQuestionStatus, signUp, theoryBusy,
} from "../src/lib/server/theory";
import { berlinToMs } from "../src/lib/time";

function setup() {
  const db = openDatabase(":memory:");
  const t = createUser(db, { email: "l@x.de", name: "Maryam Lehrerin", passwordHash: "x", role: "teacher" });
  const a = createUser(db, { email: "a@x.de", name: "Lona Scholz", passwordHash: "x", role: "student" });
  const b = createUser(db, { email: "b@x.de", name: "Ben Meyer", passwordHash: "x", role: "student" });
  const [l] = scheduleLessons(db, { title: "Vorfahrt", starts: [berlinToMs("2026-11-03", "18:00")], durationMin: 90, place: "Raum", createdBy: t.id });
  return { db, t, a, b, l };
}

test("Termin sperrt Fahrstunden-Zeit; nur Angemeldete dürfen fragen", () => {
  const { db, a, b, l } = setup();
  assert.deepEqual(theoryBusy(db, berlinToMs("2026-11-03", "00:00"), berlinToMs("2026-11-04", "00:00")),
    [{ start: berlinToMs("2026-11-03", "18:00"), end: berlinToMs("2026-11-03", "19:30") }]);
  signUp(db, l.id, a.id, "zuhause");
  assert.equal(mayParticipate(db, getLesson(db, l.id)!, a.id), true);
  assert.equal(mayParticipate(db, getLesson(db, l.id)!, b.id), false);
  const spontan = createLesson(db, "Spontan", a.id);
  assert.equal(mayParticipate(db, spontan, b.id), true, "spontane Stunde: alle");
});

test("Sichtbarkeit: zurückgehaltene Fragen sieht nur die Fahrschule (und der Fragende), Name als „Lona S.“", () => {
  const { db, t, a, b, l } = setup();
  const ok = addQuestion(db, { lessonId: l.id, userId: a.id, original: "Wer hat Vorfahrt?", lang: "de", german: "Wer hat Vorfahrt?", allowed: true, reason: "" });
  const bad = addQuestion(db, { lessonId: l.id, userId: b.id, original: "Quatsch", lang: "de", german: "Quatsch", allowed: false, reason: "Stört" });
  const forA = qaViewFor(db, l.id, { id: a.id, role: "student" });
  assert.deepEqual(forA.questions.map((q) => [q.name, q.german, q.mine]), [["Lona S.", "Wer hat Vorfahrt?", true]]);
  const forB = qaViewFor(db, l.id, { id: b.id, role: "student" });
  assert.equal(forB.questions.length, 2, "eigene zurückgehaltene Frage sieht B selbst");
  assert.equal(forB.questions.find((q) => q.id === bad)!.status, "blocked");
  const forT = qaViewFor(db, l.id, { id: t.id, role: "teacher" });
  assert.equal(forT.questions.find((q) => q.id === bad)!.reason, "Stört");
  // Beamer: genau eine Frage
  setBeamer(db, l.id, ok);
  assert.equal(qaViewFor(db, l.id, { id: b.id, role: "student" }).questions.find((q) => q.id === ok)!.onBeamer, true);
  setQuestionStatus(db, l.id, ok, "answered");
  assert.equal(qaViewFor(db, l.id, { id: b.id, role: "student" }).questions.find((q) => q.id === ok)!.onBeamer, false);
});

test("Hand heben, stummschalten senkt die Hand", () => {
  const { db, a, l } = setup();
  raiseHand(db, l.id, a.id, true);
  assert.equal(qaViewFor(db, l.id, { id: a.id, role: "student" }).myHand, true);
  setMuted(db, l.id, a.id, true);
  const v = qaViewFor(db, l.id, { id: a.id, role: "student" });
  assert.equal(v.myHand, false);
  assert.equal(v.muted, true);
});
