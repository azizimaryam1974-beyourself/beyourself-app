"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/server/db";
import { requireTeacher, requireUser } from "@/lib/server/auth";
import { getUser } from "@/lib/server/repo";
import { BookingError, getBooking } from "@/lib/server/booking";
import { cancelExam, declineExam, ensureGrundbetrag, EXAM_LABEL, getExam, inviteExam, setExamResult, type ExamType } from "@/lib/server/exams";
import { getProfile, updateProfile } from "@/lib/server/training-repo";
import { finalizePayment, notifySchool, notifyStudent, notifyUser } from "@/lib/server/payments/service";
import { formatPrice } from "@/lib/language-package";
import { berlinToMs, fmtDay, fmtTime, isDayKey } from "@/lib/time";

export interface ActionState { ok?: string; error?: string }
const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const errText = (e: unknown) => {
  if (e instanceof BookingError) return e.message;
  console.error(e);
  return "Das hat nicht geklappt. Bitte versuche es noch einmal.";
};
const refresh = (userId: string) => {
  revalidatePath(`/verwaltung/schueler/${userId}`); revalidatePath("/verwaltung"); revalidatePath("/verwaltung/kalender");
  revalidatePath("/termine"); revalidatePath("/konto");
};
const hhmm = (s: string) => /^\d{2}:\d{2}$/.test(s);

// ============ Fahrschule ======================================================

/** Einladung zur Theorie- oder Praxisprüfung (nach TÜV-Bestätigung). */
export async function inviteExamAction(_p: ActionState, form: FormData): Promise<ActionState> {
  await requireTeacher();
  const userId = str(form, "userId");
  const u = getUser(db(), userId);
  if (!u || u.role !== "student") return { error: "Schüler nicht gefunden." };
  const type = str(form, "type") as ExamType;
  if (type !== "theorie" && type !== "praxis") return { error: "Art der Prüfung fehlt." };
  const date = str(form, "date"), time = str(form, "time"), warm = str(form, "warm");
  if (!isDayKey(date) || !hhmm(time)) return { error: "Bitte Datum und Uhrzeit der Prüfung angeben." };
  if (warm && !hhmm(warm)) return { error: "Uhrzeit der Warmstunde ungültig." };
  try {
    const { exam, booking } = inviteExam(db(), {
      userId, type, startsAt: berlinToMs(date, time), place: str(form, "place"), message: str(form, "message"),
      warmAt: type === "praxis" && warm ? berlinToMs(date, warm) : null,
    });
    const warmText = exam.warmAt ? `\nWarmstunde: ${fmtTime(exam.warmAt)} Uhr (30 Min), danach fahren wir zusammen zum TÜV.` : "";
    notifyStudent(booking, `Einladung: ${EXAM_LABEL[type]}`,
      `Deine ${EXAM_LABEL[type]} ist am ${fmtDay(exam.startsAt)} um ${fmtTime(exam.startsAt)} Uhr (${exam.place}).${warmText}\n` +
      (exam.message ? `\n${exam.message}\n` : "") +
      `\nBitte bestätige verbindlich, indem du bis ${fmtDay(booking.payDeadline!)}, ${fmtTime(booking.payDeadline!)} Uhr bezahlst: ${formatPrice(booking.priceCents)}` +
      ` (${booking.lines.map((l) => `${l.label}: ${formatPrice(l.cents)}`).join(" · ")}).\nWer nicht erscheint, verliert die Gebühren.`);
    refresh(userId);
    return { ok: `Einladung verschickt. ${u.name.split(" ")[0]} hat bis ${fmtDay(booking.payDeadline!)} ${fmtTime(booking.payDeadline!)} Uhr Zeit zum Bestätigen.` };
  } catch (e) {
    return { error: errText(e) };
  }
}

/** Prüfung absagen (TÜV verschiebt / Fahrschule sagt ab) – Bezahltes geht als Guthaben zurück. */
export async function cancelExamAction(form: FormData): Promise<void> {
  await requireTeacher();
  const id = str(form, "examId");
  const e = getExam(db(), id);
  if (!e) return;
  try {
    const r = cancelExam(db(), id);
    const u = getUser(db(), e.userId);
    if (u) notifyUser(u, `${EXAM_LABEL[e.type]} abgesagt`,
      `Deine ${EXAM_LABEL[e.type]} am ${fmtDay(e.startsAt)} um ${fmtTime(e.startsAt)} Uhr findet nicht statt.` +
      (r.creditCents ? ` Die bezahlten ${formatPrice(r.creditCents)} sind als Guthaben auf deinem Konto und werden beim neuen Termin automatisch verrechnet.` : "") +
      ` Du bekommst eine neue Einladung, sobald es einen neuen Termin gibt.`, "/termine");
  } catch (err) {
    console.error(err);
  }
  refresh(e.userId);
}

export async function examResultAction(form: FormData): Promise<void> {
  await requireTeacher();
  const id = str(form, "examId");
  const result = str(form, "result");
  const e = getExam(db(), id);
  if (!e || !["passed", "failed", "no_show"].includes(result)) return;
  try {
    setExamResult(db(), id, result as "passed" | "failed" | "no_show");
    const u = getUser(db(), e.userId);
    if (u) {
      if (result === "passed") notifyUser(u, `${EXAM_LABEL[e.type]} bestanden 🎉`, e.type === "praxis"
        ? "Herzlichen Glückwunsch zum Führerschein! Wir freuen uns sehr mit dir. Gute und sichere Fahrt – deinen eigenen Weg."
        : "Herzlichen Glückwunsch zur bestandenen Theorieprüfung! Jetzt geht es weiter Richtung praktische Prüfung.");
      else if (result === "failed") notifyUser(u, `${EXAM_LABEL[e.type]} – diesmal nicht geklappt`,
        "Das passiert vielen – Kopf hoch! Wir besprechen zusammen, wie es weitergeht, und melden uns mit einem neuen Termin.");
    }
  } catch (err) {
    console.error(err);
  }
  refresh(e.userId);
}

/** Grundbetrag: bar/EC bezahlt, oder „anders geregelt“ (vor der App bezahlt / erlassen) bzw. zurücknehmen. */
export async function grundbetragAction(form: FormData): Promise<void> {
  await requireTeacher();
  const userId = str(form, "userId");
  const what = str(form, "do");
  if (!getProfile(db(), userId)) return;
  if (what === "cash") {
    const b = ensureGrundbetrag(db(), userId);
    if (b) await finalizePayment(b.id, "bar", `bar-${Date.now()}`, null);
  } else if (what === "waive") {
    updateProfile(db(), userId, { grundWaived: true });
    const open = db().prepare(`SELECT id FROM bookings WHERE user_id = ? AND offer_id = 'fee-grundbetrag' AND status = 'awaiting_payment'`).all(userId) as Array<{ id: string }>;
    for (const o of open) db().prepare(`UPDATE bookings SET status = 'withdrawn', cancelled_at = ?, cancelled_by = 'school' WHERE id = ?`).run(Date.now(), o.id);
  } else if (what === "unwaive") {
    updateProfile(db(), userId, { grundWaived: false });
    ensureGrundbetrag(db(), userId);
  }
  refresh(userId);
}

// ============ Schüler =========================================================

/** Einladung ablehnen (solange noch nicht bezahlt) – die Fahrschule wird informiert. */
export async function declineExamAction(form: FormData): Promise<void> {
  const user = await requireUser();
  let target = "/termine?abgesagt=1";
  try {
    const e = declineExam(db(), user.id, str(form, "examId"));
    const b = e.bookingId ? getBooking(db(), e.bookingId) : undefined;
    const reason = str(form, "reason").slice(0, 300);
    if (b) notifySchool(b, `Prüfung abgelehnt: ${user.name}`,
      `${user.name} kann die ${EXAM_LABEL[e.type]} am ${fmtDay(e.startsAt)} ${fmtTime(e.startsAt)} Uhr nicht wahrnehmen.${reason ? `\nGrund: ${reason}` : ""}\nBitte beim TÜV absagen und neu einladen.`);
  } catch (err) {
    target = `/termine?fehler=${encodeURIComponent(errText(err))}`;
  }
  refresh(user.id);
  redirect(target);
}
