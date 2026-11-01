"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/server/db";
import { endSession, requireTeacher, requireUser, startSession } from "@/lib/server/auth";
import { hashPassword, hashToken, newSessionToken, verifyPassword } from "@/lib/server/password";
import { loginLimiters } from "@/lib/server/rate-limit";
import {
  bookPackage,
  completePasswordReset,
  createLesson,
  createPasswordReset,
  deleteStudent,
  getUser,
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
import { ensureProfile } from "@/lib/server/training-repo";
import { signups } from "@/lib/server/theory";
import { ensureGrundbetrag } from "@/lib/server/exams";
import { saveDetails } from "@/lib/server/user-details";
import { addNotification } from "@/lib/server/booking";
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
    birthday: input.birthday,
    street: input.street,
    zip: input.zip,
    city: input.city,
    licenseClass: input.licenseClass,
    wantsPackage: input.wantsPackage ? "yes" : "no",
    language: input.language ?? "",
    acceptPrivacy: input.acceptPrivacy ? "on" : "",
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
    saveDetails(d, u.id, result.value);
    ensureProfile(d, u.id, result.value.licenseClass);
    ensureGrundbetrag(d, u.id); // Grundbetrag wird mit der Anmeldung fällig
    if (result.value.language) bookPackage(d, u.id, result.value.language);
    return u;
  })();

  await startSession(user.id);
  redirect(result.value.language ? "/konto?gebucht=1&willkommen=1" : "/konto?willkommen=1");
}

export async function loginAction(_prev: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "unbekannt";
  const lim = loginLimiters();
  const wait = Math.max(lim.email.blockedFor(email), lim.ip.blockedFor(ip));
  if (wait > 0) {
    return { error: `Zu viele Fehlversuche. Bitte in ${Math.ceil(wait / 60_000)} Minuten erneut versuchen.`, values: { email } };
  }
  const user = findUserByEmail(db(), email);
  // Gleiche Meldung für beide Fälle, damit niemand Konten ausprobieren kann.
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    lim.email.fail(email);
    lim.ip.fail(ip);
    await new Promise((r) => setTimeout(r, 400));
    return { error: "E-Mail oder Passwort stimmt nicht.", values: { email } };
  }
  lim.email.reset(email);
  await startSession(user.id);
  redirect(user.role === "teacher" ? "/verwaltung/uebersicht" : "/konto");
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
  const wasLive = getLesson(db(), lessonId)?.status === "live";
  setLessonStatus(db(), lessonId, live ? "live" : "ended");
  hub().setLive(lessonId, live);
  // Angemeldete Schüler erfahren in der App, dass die Stunde beginnt.
  if (live && !wasLive) {
    const l = getLesson(db(), lessonId)!;
    for (const s of signups(db(), lessonId)) addNotification(db(), s.userId, null, "Theorie beginnt jetzt", `„${l.title}“ hat begonnen. Unter „Theorie“ kannst du mitlesen und Fragen stellen.`);
  }
  revalidatePath(`/unterricht/${lessonId}`);
  revalidatePath("/unterricht");
  revalidatePath("/konto");
}

/** Live-Stunde direkt aus der Liste beenden. */
export async function endLessonAction(form: FormData): Promise<void> {
  await setLessonLiveAction(String(form.get("lessonId") ?? ""), false);
}

// ---------- Passwort zurücksetzen ---------------------------------------------

const RESET_TTL_MS = 24 * 60 * 60 * 1000;

/** Lehrkraft erzeugt einen Einmal-Link (24 h) und gibt ihn dem Schüler. */
export async function createResetLinkAction(_prev: { link?: string; error?: string }, form: FormData) {
  const teacher = await requireTeacher();
  const userId = String(form.get("userId"));
  const user = getUser(db(), userId);
  if (!user) return { error: "Konto nicht gefunden" };
  const token = newSessionToken();
  createPasswordReset(db(), hashToken(token), user.id, teacher.id, RESET_TTL_MS);
  const base = process.env.APP_URL || "";
  return { link: `${base}/passwort/${token}` };
}

export async function resetPasswordAction(_prev: FormState, form: FormData): Promise<FormState> {
  const token = String(form.get("token") ?? "");
  const pw = String(form.get("password") ?? "");
  const pw2 = String(form.get("password2") ?? "");
  if (pw.length < 10) return { fieldErrors: { password: "Das Passwort braucht mindestens 10 Zeichen." } };
  if (pw !== pw2) return { fieldErrors: { password: "Die beiden Passwörter sind nicht gleich." } };
  const user = completePasswordReset(db(), hashToken(token), await hashPassword(pw));
  if (!user) return { error: "Der Link ist abgelaufen oder wurde schon benutzt. Bitte bei der Fahrschule einen neuen anfordern." };
  loginLimiters().email.reset(user.email);
  await startSession(user.id);
  redirect(user.role === "teacher" ? "/unterricht" : "/konto");
}

// ---------- DSGVO: Konto löschen ---------------------------------------------

export async function deleteStudentAction(form: FormData): Promise<void> {
  await requireTeacher();
  if (form.get("confirm") !== "on") return;
  deleteStudent(db(), String(form.get("userId")));
  revalidatePath("/verwaltung");
}
