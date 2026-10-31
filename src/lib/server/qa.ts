import "server-only";
import { db } from "./db";
import { hub } from "./live";
import { qaViewFor } from "./theory";

/** Fragenliste an alle Verbundenen der Stunde schicken – jeder bekommt seine eigene Sicht. */
export function pushQa(lessonId: string): void {
  hub().sendEach(lessonId, (l) => ({ type: "qa", data: qaViewFor(db(), lessonId, { id: l.userId, role: l.role ?? "student" }) }));
}
