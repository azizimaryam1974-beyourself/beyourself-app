"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/server/db";
import { requireTeacher, requireUser } from "@/lib/server/auth";
import { getDoc, removeDoc, setDocStatus } from "@/lib/server/student-docs";
import { deleteUpload } from "@/lib/server/uploads";
import { getProfile, updateProfile } from "@/lib/server/training-repo";
import { addNotification } from "@/lib/server/booking";
import { DOC_INFO } from "@/lib/server/student-docs";

const refresh = (userId: string) => { revalidatePath("/konto"); revalidatePath(`/verwaltung/schueler/${userId}`); revalidatePath("/verwaltung/uebersicht"); };

/** Fahrschule: Unterlage als geprüft markieren oder ablehnen (mit kurzem Grund). */
export async function docStatusAction(form: FormData): Promise<void> {
  await requireTeacher();
  const doc = getDoc(db(), String(form.get("id") ?? ""));
  if (!doc) return;
  const status = String(form.get("status") ?? "");
  if (status !== "ok" && status !== "abgelehnt" && status !== "neu") return;
  const note = String(form.get("note") ?? "").trim();
  const d = db();
  setDocStatus(d, doc.id, status, status === "abgelehnt" ? note : "");
  // Sehtest / Erste Hilfe geprüft → in der Akte abhaken (Datum bleibt, falls schon gesetzt)
  if (status === "ok" && (doc.type === "sehtest" || doc.type === "erstehilfe")) {
    const p = getProfile(d, doc.userId);
    const key = doc.type === "sehtest" ? "sehtestAt" : "ersteHilfeAt";
    if (p && !p[key]) updateProfile(d, doc.userId, { [key]: Date.now() });
  }
  if (status === "abgelehnt") {
    addNotification(d, doc.userId, null, `Bitte „${DOC_INFO[doc.type].label}“ neu hochladen`, note ? `Grund: ${note}. Du findest das unter „Mein Konto“ → „Meine Unterlagen“.` : "Die Datei war nicht gut lesbar. Du findest das unter „Mein Konto“ → „Meine Unterlagen“.");
  }
  refresh(doc.userId);
}

/** Unterlage löschen: Fahrschule immer, Schüler nur, solange sie noch nicht geprüft ist. */
export async function deleteDocAction(form: FormData): Promise<void> {
  const me = await requireUser();
  const doc = getDoc(db(), String(form.get("id") ?? ""));
  if (!doc) return;
  if (me.role !== "teacher" && (doc.userId !== me.id || doc.status === "ok")) return;
  const path = removeDoc(db(), doc.id);
  if (path) deleteUpload(path);
  refresh(doc.userId);
}
