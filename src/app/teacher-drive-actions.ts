"use server";

import { auditAction } from "@/lib/server/audit-context";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/server/db";
import { requireTeacher } from "@/lib/server/auth";
import { BookingError } from "@/lib/server/booking";
import { bookDrive } from "@/lib/server/drive-booking";
import { isDriveKind } from "@/lib/server/training-repo";
import { finalizePayment, notifyStudent, PaymentError, startPayment, when } from "@/lib/server/payments/service";
import { berlinToMs, dayKey, isDayKey } from "@/lib/time";
import { formatPrice } from "@/lib/language-package";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

/** Fahrschule trägt eine Fahrt für einen Schüler ein – mit Zahlung bar/EC, aus Guthaben oder „Schüler zahlt bis zur Fahrt“. */
export async function teacherBookDriveAction(form: FormData): Promise<void> {
  await auditAction("teacher-drive-actions:teacherBookDriveAction", [form]);
  await requireTeacher();
  const userId = str(form, "userId"), kind = str(form, "kind"), day = str(form, "day"), time = str(form, "time");
  const minutes = Number(str(form, "minutes")), pay = str(form, "pay");
  const back = (q: string) => redirect(`/verwaltung/kalender?tag=${isDayKey(day) ? day : dayKey(Date.now())}&${q}`);
  let target = "";
  try {
    if (!userId) throw new BookingError("Bitte einen Schüler wählen.");
    if (!isDriveKind(kind)) throw new BookingError("Bitte die Art der Fahrt wählen.");
    if (!isDayKey(day) || !/^\d{1,2}:\d{2}$/.test(time)) throw new BookingError("Bitte Tag und Uhrzeit wählen.");
    const start = berlinToMs(day, time.padStart(5, "0"));
    const b = bookDrive(db(), { userId, kind, minutes, start, meetingPoint: str(form, "meeting"), note: str(form, "note") }, Date.now(), { byTeacher: true });
    // Zahlungsfrist bei „zahlt bis zur Fahrt“: bis zum Beginn (statt 30 Minuten)
    db().prepare(`UPDATE bookings SET pay_deadline = ? WHERE id = ?`).run(Math.max(start, Date.now() + 3_600_000), b.id);
    let paid = "";
    if (pay === "bar") { await finalizePayment(b.id, "bar", `bar-${Date.now()}`, null); paid = " (bar/EC bezahlt)"; }
    else if (pay === "guthaben") {
      try { await startPayment(b.id, userId, "guthaben"); paid = " (mit Guthaben bezahlt)"; }
      catch (e) { paid = e instanceof PaymentError ? ` – Guthaben reicht nicht, Zahlung offen` : ""; }
    }
    if (pay !== "bar" && pay !== "guthaben" || paid.includes("offen")) {
      notifyStudent(b, "Neue Fahrstunde eingetragen", `Die Fahrschule hat für dich ${b.title} am ${when(b)} eingetragen (${formatPrice(b.priceCents)}). Bitte bezahle bis zur Fahrt unter „Fahrstunden“ oder bar in der Fahrschule.`);
    }
    target = `ok=${encodeURIComponent(`Fahrt eingetragen: ${b.userName} · ${b.title}${paid}`)}`;
  } catch (e) {
    const msg = e instanceof BookingError ? e.message : "Das hat nicht geklappt.";
    if (!(e instanceof BookingError)) console.error(e);
    target = `fehler=${encodeURIComponent(msg)}`;
  }
  revalidatePath("/verwaltung/kalender");
  back(target);
}
