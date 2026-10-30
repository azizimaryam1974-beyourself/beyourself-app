"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/server/db";
import { endSession, requireTeacher, requireUser, startSession } from "@/lib/server/auth";
import { hashPassword, verifyPassword } from "@/lib/server/password";
import {
  bookPackage,
  createLesson,
  createUser,
  currentPackage,
  findUserByEmail,
  getLesson,
  PackageAlreadyBookedError,
  setLessonStatus,
  setPackageLanguage,
  setPackageStatus,
} from "@/lib/server/repo";
import { hub } from "@/lib/server/live";
import { parseSignupForm, validateSignup, type FieldErrors } from "@/lib/signup";
import { validateSignupChoice } from "@/lib/language-package";
import { isBookableLanguage } from "@/lib/languages";

export interface FormState {
  error?: string;
  fieldErrors?: FieldErrors;
  values?: Record<string, string>;
}

// ---------- Anmeldung ---------------------------------------------------------

export async function signupAction(_prev: FormState, form: FormData): Promise<FormState> {
  const input = parseSignupForm(form);
  const values = {
    name: input.name,
    email: input.email,
    phone: input.phone,
    wantsPackage: input.wantsPackage ? "yes" : "no",
    language: input.language ?? "",
  };
  const result = validateSignup(input);
  if (!result.ok) return { fieldErrors: result.errors, values };

  const d = db();
  if (findUserByEmail(d, result.value.email)) {
    return { fieldErrors: { email: "Mit dieser E-Mail gibt es schon ein Konto. Bitte melde dich an." }, values };
  }
  const passwordHash = await hashPassword(result.value.password);

  // Konto + Paket in einer Transaktion: entweder beides oder nichts.
  const user = d.transaction(() => {
    const u = createUser(d, { ...result.value, passwordHash, role: "student" });
    if (result.value.language) bookPackage(d, u.id, result.value.language);
    return u;
  })();

  await startSession(user.id);
  redirect(result.value.language ? "/konto?gebucht=1" : "/konto");
}

export async function loginAction(_prev: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const user = findUserByEmail(db(), email);
  // Gleiche Meldung für beide Fälle, damit niemand Konten ausprobieren kann.
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    await new Promise((r) => setTimeout(r, 400));
    return { error: "E-Mail oder Passwort stimmt nicht.", values: { email } };
  }
  await startSession(user.id);
  redirect(user.role === "teacher" ? "/unterricht" : "/konto");
}

export async function logoutAction(): Promise<void> {
  await endSession();
  redirect("/");
}

/** Paket nachträglich buchen (wer es bei der Anmeldung nicht gewählt hat). */
export async function bookLaterAction(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const language = String(form.get("language") ?? "");
  const choice = validateSignupChoice({ wantsPackage: true, language });
  if (!choice.ok) return { error: choice.error };
  if (form.get("acceptPackageTerms") !== "on") return { error: "Bitte bestätige die Bedingungen für das Sprachpaket." };
  try {
    bookPackage(db(), user.id, choice.value!.language);
  } catch (e) {
    if (e instanceof PackageAlreadyBookedError) return { error: e.message };
    throw e;
  }
  revalidatePath("/konto");
  redirect("/konto?gebucht=1");
}

// ---------- Verwaltung (nur Lehrkraft) ----------------------------------------

export async function setPackageStatusAction(form: FormData): Promise<void> {
  await requireTeacher();
  const id = String(form.get("packageId"));
  const status = String(form.get("status"));
  if (status !== "paid" && status !== "cancelled" && status !== "booked") return;
  setPackageStatus(db(), id, status);
  revalidatePath("/verwaltung");
}

export async function setPackageLanguageAction(form: FormData): Promise<void> {
  await requireTeacher();
  const id = String(form.get("packageId"));
  const language = String(form.get("language"));
  if (!isBookableLanguage(language)) return;
  setPackageLanguage(db(), id, language);
  revalidatePath("/verwaltung");
}

/** Lehrkraft bucht für einen Schüler (z. B. bei Anmeldung im Büro). */
export async function teacherBookAction(form: FormData): Promise<void> {
  await requireTeacher();
  const userId = String(form.get("userId"));
  const language = String(form.get("language"));
  if (!isBookableLanguage(language)) return;
  const existing = currentPackage(db(), userId);
  if (existing && existing.status !== "cancelled") return;
  bookPackage(db(), userId, language);
  revalidatePath("/verwaltung");
}

// ---------- Theoriestunden ----------------------------------------------------

export async function createLessonAction(form: FormData): Promise<void> {
  const teacher = await requireTeacher();
  const lesson = createLesson(db(), String(form.get("title") ?? ""), teacher.id);
  redirect(`/unterricht/${lesson.id}`);
}

export async function setLessonLiveAction(lessonId: string, live: boolean): Promise<void> {
  await requireTeacher();
  if (!getLesson(db(), lessonId)) return;
  setLessonStatus(db(), lessonId, live ? "live" : "ended");
  hub().setLive(lessonId, live);
  revalidatePath(`/unterricht/${lessonId}`);
  revalidatePath("/unterricht");
  revalidatePath("/konto");
}
