"use server";

import { auditAction } from "@/lib/server/audit-context";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/server/db";
import { requireTeacher, requireUser } from "@/lib/server/auth";
import { BookingError } from "@/lib/server/booking";
import { deleteScheduledLesson, scheduleLessons, signOff, signUp, type SignupMode } from "@/lib/server/theory";
import { addDays, berlinToMs, isDayKey } from "@/lib/time";

export interface ActionState { ok?: string; error?: string }
const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

export async function scheduleLessonAction(_p: ActionState, form: FormData): Promise<ActionState> {
  await auditAction("theory-actions:scheduleLessonAction", [_p, form]);
  const teacher = await requireTeacher();
  const day = str(form, "date"), time = str(form, "time");
  const weeks = Math.min(26, Math.max(1, Number(str(form, "weeks")) || 1));
  if (!isDayKey(day) || !/^\d{1,2}:\d{2}$/.test(time)) return { error: "Bitte Datum und Uhrzeit angeben." };
  const starts = Array.from({ length: weeks }, (_, i) => berlinToMs(addDays(day, i * 7), time)).filter((t) => t > Date.now());
  try {
    const list = scheduleLessons(db(), { title: str(form, "title"), starts, durationMin: Number(str(form, "duration")) || 90, place: str(form, "place"), createdBy: teacher.id });
    revalidatePath("/unterricht"); revalidatePath("/theorie"); revalidatePath("/verwaltung/kalender");
    return { ok: `${list.length} Termin${list.length === 1 ? "" : "e"} geplant. Deine Schüler sehen sie unter „Theorie“ und können sich anmelden. Fahrstunden sind in dieser Zeit automatisch gesperrt.` };
  } catch (e) {
    return { error: e instanceof BookingError ? e.message : "Das hat nicht geklappt." };
  }
}

export async function deleteLessonAction(form: FormData): Promise<void> {
  await auditAction("theory-actions:deleteLessonAction", [form]);
  await requireTeacher();
  deleteScheduledLesson(db(), str(form, "lessonId"));
  revalidatePath("/unterricht"); revalidatePath("/theorie");
}

export async function signupAction(form: FormData): Promise<void> {
  await auditAction("theory-actions:signupAction", [form]);
  const user = await requireUser();
  const mode = str(form, "mode");
  try {
    if (mode === "off") signOff(db(), str(form, "lessonId"), user.id);
    else signUp(db(), str(form, "lessonId"), user.id, (mode === "zuhause" ? "zuhause" : "raum") as SignupMode);
  } catch (e) {
    redirect(`/theorie?fehler=${encodeURIComponent(e instanceof BookingError ? e.message : "Das hat nicht geklappt.")}`);
  }
  revalidatePath("/theorie");
}
