import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { BookingError } from "./booking";
import { getLesson, type Lesson } from "./repo";
import { shortName } from "../moderation";

/**
 * Theorie-Termine (mit Anmeldung) und Fragen im Live-Unterricht.
 * Teilnahme „im Raum“ oder „von zu Hause“ – von zu Hause zählt erst nach der Führerscheinreform als Pflichtstunde.
 */

export type SignupMode = "raum" | "zuhause";
export type QuestionStatus = "visible" | "blocked" | "hidden" | "answered";

// ---------- Termine ------------------------------------------------------------------

export function scheduleLessons(db: Database.Database, o: { title: string; starts: number[]; durationMin: number; place: string; createdBy: string }): Lesson[] {
  if (!o.starts.length) throw new BookingError("Bitte Datum und Uhrzeit angeben.");
  if (o.durationMin < 30 || o.durationMin > 300) throw new BookingError("Dauer bitte zwischen 30 und 300 Minuten.");
  const out: Lesson[] = [];
  const now = new Date().toISOString();
  db.transaction(() => {
    for (const at of o.starts) {
      const id = randomUUID();
      db.prepare(`INSERT INTO lessons (id,title,status,created_by,created_at,scheduled_at,duration_min,place) VALUES (?,?,?,?,?,?,?,?)`)
        .run(id, o.title.trim().slice(0, 120) || "Theoriestunde", "planned", o.createdBy, now, at, o.durationMin, o.place.trim().slice(0, 120));
      out.push(getLesson(db, id)!);
    }
  })();
  return out;
}

export function upcomingLessons(db: Database.Database, from: number, to: number): Lesson[] {
  return db.prepare(`SELECT * FROM lessons WHERE scheduled_at IS NOT NULL AND scheduled_at + duration_min * 60000 > ? AND scheduled_at < ? AND status != 'ended' ORDER BY scheduled_at`)
    .all(from, to) as Lesson[];
}

/** Geplante Theoriestunden blockieren Fahrstunden-Zeiten. */
export function theoryBusy(db: Database.Database, from: number, to: number): Array<{ start: number; end: number }> {
  return (db.prepare(`SELECT scheduled_at, duration_min FROM lessons WHERE scheduled_at IS NOT NULL AND status != 'ended' AND scheduled_at < ? AND scheduled_at + duration_min * 60000 > ?`)
    .all(to, from) as Array<{ scheduled_at: number; duration_min: number }>).map((l) => ({ start: l.scheduled_at, end: l.scheduled_at + l.duration_min * 60_000 }));
}

export function deleteScheduledLesson(db: Database.Database, id: string): void {
  db.prepare(`DELETE FROM lessons WHERE id = ? AND status = 'planned'`).run(id);
}

// ---------- Anmeldung ------------------------------------------------------------------

export function signUp(db: Database.Database, lessonId: string, userId: string, mode: SignupMode): void {
  const l = getLesson(db, lessonId);
  if (!l || l.status === "ended") throw new BookingError("Diese Stunde ist schon vorbei.");
  db.prepare(`INSERT INTO lesson_signups (lesson_id,user_id,mode,created_at) VALUES (?,?,?,?) ON CONFLICT(lesson_id,user_id) DO UPDATE SET mode = excluded.mode`)
    .run(lessonId, userId, mode, Date.now());
}

export function signOff(db: Database.Database, lessonId: string, userId: string): void {
  db.prepare(`DELETE FROM lesson_signups WHERE lesson_id = ? AND user_id = ?`).run(lessonId, userId);
}

export function signupOf(db: Database.Database, lessonId: string, userId: string): SignupMode | null {
  const r = db.prepare(`SELECT mode FROM lesson_signups WHERE lesson_id = ? AND user_id = ?`).get(lessonId, userId) as { mode: SignupMode } | undefined;
  return r?.mode ?? null;
}

export function signups(db: Database.Database, lessonId: string): Array<{ userId: string; name: string; mode: SignupMode }> {
  return (db.prepare(`SELECT s.user_id, u.name, s.mode FROM lesson_signups s JOIN users u ON u.id = s.user_id WHERE s.lesson_id = ? ORDER BY u.name`).all(lessonId) as Array<{ user_id: string; name: string; mode: SignupMode }>)
    .map((r) => ({ userId: r.user_id, name: r.name, mode: r.mode }));
}

export function signupCount(db: Database.Database, lessonId: string): { raum: number; zuhause: number } {
  const rows = db.prepare(`SELECT mode, COUNT(*) AS n FROM lesson_signups WHERE lesson_id = ? GROUP BY mode`).all(lessonId) as Array<{ mode: SignupMode; n: number }>;
  return { raum: rows.find((r) => r.mode === "raum")?.n ?? 0, zuhause: rows.find((r) => r.mode === "zuhause")?.n ?? 0 };
}

/** Darf dieser Schüler in der Stunde fragen? Geplante Stunden: nur Angemeldete. Spontane Stunden: alle Schüler. */
export function mayParticipate(db: Database.Database, lesson: Lesson, userId: string): boolean {
  if (!lesson.scheduled_at) return true;
  return signupOf(db, lesson.id, userId) !== null;
}

// ---------- Fragen & Hand heben ----------------------------------------------------------

export interface Question {
  id: string; lessonId: string; userId: string; name: string; original: string; lang: string; german: string;
  status: QuestionStatus; reason: string; onBeamer: boolean; createdAt: number;
}

export function addQuestion(db: Database.Database, q: { lessonId: string; userId: string; original: string; lang: string; german: string; allowed: boolean; reason: string }, now = Date.now()): string {
  const id = randomUUID();
  db.prepare(`INSERT INTO lesson_questions (id,lesson_id,user_id,original,lang,german,status,reason,created_at) VALUES (?,?,?,?,?,?,?,?,?)`)
    .run(id, q.lessonId, q.userId, q.original.slice(0, 300), q.lang, q.german.slice(0, 400), q.allowed ? "visible" : "blocked", q.reason, now);
  return id;
}

export function listQuestions(db: Database.Database, lessonId: string): Question[] {
  return (db.prepare(`SELECT q.*, u.name FROM lesson_questions q JOIN users u ON u.id = q.user_id WHERE q.lesson_id = ? ORDER BY q.created_at`).all(lessonId) as Array<Record<string, unknown>>)
    .map((r) => ({
      id: r.id as string, lessonId: r.lesson_id as string, userId: r.user_id as string, name: shortName(r.name as string),
      original: r.original as string, lang: r.lang as string, german: r.german as string, status: r.status as QuestionStatus,
      reason: r.reason as string, onBeamer: !!r.on_beamer, createdAt: r.created_at as number,
    }));
}

/** Letzte Frage dieses Schülers (für die Wartezeit zwischen zwei Fragen). */
export function lastQuestionAt(db: Database.Database, lessonId: string, userId: string): number {
  return (db.prepare(`SELECT MAX(created_at) AS t FROM lesson_questions WHERE lesson_id = ? AND user_id = ?`).get(lessonId, userId) as { t: number | null }).t ?? 0;
}

export function setQuestionStatus(db: Database.Database, lessonId: string, id: string, status: QuestionStatus): void {
  db.prepare(`UPDATE lesson_questions SET status = ?, on_beamer = CASE WHEN ? = 'visible' THEN on_beamer ELSE 0 END WHERE id = ? AND lesson_id = ?`).run(status, status, id, lessonId);
}

/** Genau eine Frage auf dem Beamer (oder keine). */
export function setBeamer(db: Database.Database, lessonId: string, id: string | null): void {
  db.transaction(() => {
    db.prepare(`UPDATE lesson_questions SET on_beamer = 0 WHERE lesson_id = ?`).run(lessonId);
    if (id) db.prepare(`UPDATE lesson_questions SET on_beamer = 1, status = 'visible' WHERE id = ? AND lesson_id = ?`).run(id, lessonId);
  })();
}

export function raiseHand(db: Database.Database, lessonId: string, userId: string, up: boolean): void {
  if (up) db.prepare(`INSERT OR IGNORE INTO lesson_hands (lesson_id,user_id,raised_at) VALUES (?,?,?)`).run(lessonId, userId, Date.now());
  else db.prepare(`DELETE FROM lesson_hands WHERE lesson_id = ? AND user_id = ?`).run(lessonId, userId);
}

export function listHands(db: Database.Database, lessonId: string): Array<{ userId: string; name: string; raisedAt: number }> {
  return (db.prepare(`SELECT h.user_id, u.name, h.raised_at FROM lesson_hands h JOIN users u ON u.id = h.user_id WHERE h.lesson_id = ? ORDER BY h.raised_at`).all(lessonId) as Array<{ user_id: string; name: string; raised_at: number }>)
    .map((r) => ({ userId: r.user_id, name: shortName(r.name), raisedAt: r.raised_at }));
}

export function setMuted(db: Database.Database, lessonId: string, userId: string, muted: boolean): void {
  if (muted) {
    db.prepare(`INSERT OR IGNORE INTO lesson_mutes (lesson_id,user_id) VALUES (?,?)`).run(lessonId, userId);
    db.prepare(`DELETE FROM lesson_hands WHERE lesson_id = ? AND user_id = ?`).run(lessonId, userId);
  } else db.prepare(`DELETE FROM lesson_mutes WHERE lesson_id = ? AND user_id = ?`).run(lessonId, userId);
}

export function isMuted(db: Database.Database, lessonId: string, userId: string): boolean {
  return !!db.prepare(`SELECT 1 FROM lesson_mutes WHERE lesson_id = ? AND user_id = ?`).get(lessonId, userId);
}

export function mutedUsers(db: Database.Database, lessonId: string): string[] {
  return (db.prepare(`SELECT user_id FROM lesson_mutes WHERE lesson_id = ?`).all(lessonId) as Array<{ user_id: string }>).map((r) => r.user_id);
}

/** Was eine Person von den Fragen sehen darf. Fahrschule/Beamer-Kontrolle: alles. Schüler: sichtbare + eigene. */
export interface QaView {
  questions: Array<Pick<Question, "id" | "name" | "german" | "original" | "lang" | "status" | "onBeamer" | "createdAt"> & { mine: boolean; reason?: string; userId?: string }>;
  hands: Array<{ name: string; raisedAt: number; userId?: string }>;
  myHand: boolean;
  muted: boolean;
  muted_ids?: string[];
}

export function qaViewFor(db: Database.Database, lessonId: string, viewer: { id: string; role: "teacher" | "student" }): QaView {
  const qs = listQuestions(db, lessonId);
  const hands = listHands(db, lessonId);
  if (viewer.role === "teacher") {
    return {
      questions: qs.map((q) => ({ id: q.id, name: q.name, german: q.german, original: q.original, lang: q.lang, status: q.status, onBeamer: q.onBeamer, createdAt: q.createdAt, mine: false, reason: q.reason, userId: q.userId })),
      hands: hands.map((h) => ({ name: h.name, raisedAt: h.raisedAt, userId: h.userId })),
      myHand: false, muted: false, muted_ids: mutedUsers(db, lessonId),
    };
  }
  return {
    questions: qs.filter((q) => q.status === "visible" || q.status === "answered" || q.userId === viewer.id)
      .map((q) => ({ id: q.id, name: q.name, german: q.german, original: q.original, lang: q.lang, status: q.userId === viewer.id || q.status !== "blocked" ? q.status : "hidden", onBeamer: q.onBeamer, createdAt: q.createdAt, mine: q.userId === viewer.id })),
    hands: hands.map((h) => ({ name: h.name, raisedAt: h.raisedAt })),
    myHand: hands.some((h) => h.userId === viewer.id),
    muted: isMuted(db, lessonId, viewer.id),
  };
}
