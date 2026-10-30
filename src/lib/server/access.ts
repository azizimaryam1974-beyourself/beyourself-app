import "server-only";
import { hasTranslationAccess } from "../language-package";
import type { TargetLanguageCode } from "../languages";
import { db } from "./db";
import { currentPackage, getLesson, type Lesson, type User } from "./repo";
import { hub } from "./live";

/** Sprache, in der diese Person live mitliest (null = deutsches Original). */
export function listenerLanguage(user: User): TargetLanguageCode | null {
  if (user.role === "teacher") return null;
  const pkg = currentPackage(db(), user.id);
  return hasTranslationAccess(pkg) ? pkg!.language : null;
}

/** Wer darf ein Azure-Speech-Token holen? Lehrkraft (Mikrofon) und Paketinhaber (Vorlesen). */
export function maySpeech(user: User): boolean {
  return user.role === "teacher" || listenerLanguage(user) !== null;
}

/** Hub-Zustand nach einem Server-Neustart mit der Datenbank abgleichen. */
export function syncLessonLive(lesson: Lesson): void {
  const h = hub();
  const live = lesson.status === "live";
  if (h.isLive(lesson.id) !== live) h.setLive(lesson.id, live);
}

export function lessonOr404(id: string): Lesson | null {
  return getLesson(db(), id) ?? null;
}
