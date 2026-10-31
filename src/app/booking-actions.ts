"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/server/db";
import { requireTeacher, requireUser } from "@/lib/server/auth";
import { currentPackage } from "@/lib/server/repo";
import {
  BookingError, cancelByAdmin, cancelByStudent, closeSlot, confirmBooking, createSlots, declineBooking, deleteTemplate,
  getBooking, getOffer, listTemplates, markNotificationsRead, orderProduct, requestSlot, saveOffer, saveSettings, saveTemplate,
  type OfferKind, type TemplateKind,
} from "@/lib/server/booking";
import { finalizePayment, notifySchool, notifyStudent, notifyUser, refundBooking, runWaitlistJobs, when } from "@/lib/server/payments/service";
import { cancelDriveByStudent, schoolCancelCredit } from "@/lib/server/cancel";
import { addCredit, creditBalance, releaseHold } from "@/lib/server/credit";
import { releaseToWaitlist } from "@/lib/server/drive-booking";
import { addWaitlist, removeWaitlist } from "@/lib/server/waitlist";
import { getUser } from "@/lib/server/repo";
import { formatPrice } from "@/lib/language-package";
import { addDays, berlinToMs, fmtTime, isDayKey, weekdayOf } from "@/lib/time";

export interface ActionState { ok?: string; error?: string }

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const bookingErr = (e: unknown): string => {
  if (e instanceof BookingError) return e.message;
  console.error(e);
  return "Das hat nicht geklappt. Bitte versuche es noch einmal.";
};

/** "65", "65,50", "65.50 €" → Cent */
function parseEuro(s: string): number {
  const m = /^(\d{1,5})(?:[.,](\d{1,2}))?$/.exec(s.replace(/[€\s]/g, ""));
  if (!m) return NaN;
  return Number(m[1]) * 100 + Number((m[2] ?? "0").padEnd(2, "0"));
}

function refresh() {
  revalidatePath("/termine");
  revalidatePath("/verwaltung/kalender");
  revalidatePath("/konto");
}

// ============ Schüler =========================================================

export async function requestSlotAction(form: FormData): Promise<void> {
  const user = await requireUser();
  let target = "/termine?angefragt=1#meine";
  try {
    const b = requestSlot(db(), user.id, str(form, "slotId"), str(form, "note"));
    notifySchool(b, `Neue Anfrage: ${user.name}`, `${user.name} fragt „${b.title}“ an: ${when(b)}.${b.studentNote ? `\nNotiz: ${b.studentNote}` : ""}`);
  } catch (e) {
    target = `/termine?fehler=${encodeURIComponent(bookingErr(e))}`;
  }
  refresh();
  redirect(target);
}

export async function orderProductAction(form: FormData): Promise<void> {
  const user = await requireUser();
  const offerId = str(form, "offerId");
  let target = "/termine#offen";
  try {
    const offer = getOffer(db(), offerId);
    let packageId: string | undefined;
    if (offer?.kind === "language") {
      const pkg = currentPackage(db(), user.id);
      if (!pkg || pkg.status !== "booked") throw new BookingError("Bitte buche zuerst dein Sprachpaket (Sprache wählen) unter „Mein Konto“.");
      packageId = pkg.id;
    }
    const b = orderProduct(db(), user.id, offerId, { packageId });
    if (b.status === "requested") {
      notifySchool(b, `Neue Bestellung: ${user.name}`, `${user.name} möchte „${b.title}“ (${formatPrice(b.priceCents)}) kaufen. Bitte bestätigen.`);
      target = "/termine?angefragt=1#meine";
    }
  } catch (e) {
    target = `/termine?fehler=${encodeURIComponent(bookingErr(e))}`;
  }
  refresh();
  redirect(target);
}

export async function cancelMyBookingAction(form: FormData): Promise<void> {
  const user = await requireUser();
  let target = "/termine?abgesagt=1#meine";
  try {
    const before = getBooking(db(), str(form, "bookingId"));
    if (before?.kind) {
      // Fahrt: Absage-Regeln (kostenlos / spät / Last-Minute), Rückgabe als Guthaben, Zeit an die Warteliste
      const { booking, info, freed } = cancelDriveByStudent(db(), user.id, str(form, "bookingId"));
      if (info.mode === "free" || info.mode === "late") {
        const text = info.mode === "free"
          ? `Du hast „${booking.title}“ am ${when(booking)} rechtzeitig abgesagt. ${formatPrice(info.creditCents)} sind als Guthaben auf deinem Konto.`
          : `Du hast „${booking.title}“ am ${when(booking)} kurzfristig abgesagt. ${formatPrice(info.chargeCents)} werden berechnet, ${formatPrice(info.creditCents)} sind als Guthaben auf deinem Konto. Wird der Termin neu besetzt, bekommst du auch den Rest als Guthaben.`;
        notifyStudent(booking, "Fahrt abgesagt", text);
        notifySchool(booking, `Absage: ${user.name}`, `${user.name} hat ${booking.title} (${when(booking)}) abgesagt (${info.mode === "free" ? "rechtzeitig" : "kurzfristig"}). Die Zeit ist wieder frei.`);
        target = "/termine?abgesagt=1#guthaben";
      }
      if (freed) { releaseToWaitlist(db(), freed.start, freed.end, user.id); runWaitlistJobs(); }
    } else {
      cancelByStudent(db(), user.id, str(form, "bookingId"));
      releaseHold(db(), str(form, "bookingId"));
    }
  } catch (e) {
    target = `/termine?fehler=${encodeURIComponent(bookingErr(e))}`;
  }
  refresh();
  redirect(target);
}

export async function markReadAction(): Promise<void> {
  const user = await requireUser();
  markNotificationsRead(db(), user.id);
  refresh();
}

// ============ Fahrschule ======================================================

/** Termine freigeben: ab Datum, Startzeit, n Stunden hintereinander, an Wochentagen, für x Wochen. */
export async function createSlotsAction(_p: ActionState, form: FormData): Promise<ActionState> {
  await requireTeacher();
  const date = str(form, "date"), time = str(form, "time"), offerId = str(form, "offerId");
  const count = Math.min(12, Math.max(1, Number(form.get("count") ?? 1) | 0));
  const gap = Math.min(240, Math.max(0, Number(form.get("gap") ?? 0) | 0));
  const weeks = Math.min(26, Math.max(1, Number(form.get("weeks") ?? 1) | 0));
  const days = form.getAll("weekday").map(Number).filter((n) => n >= 0 && n <= 6);
  if (!isDayKey(date) || !/^\d{1,2}:\d{2}$/.test(time)) return { error: "Bitte Datum und Uhrzeit angeben." };
  const offer = getOffer(db(), offerId);
  if (!offer || offer.kind !== "slot") return { error: "Bitte die Art der Fahrstunde wählen." };
  const weekdays = days.length ? days : [weekdayOf(date)];
  const starts: number[] = [];
  for (let i = 0; i < weeks * 7; i++) {
    const day = addDays(date, i);
    if (!weekdays.includes(weekdayOf(day))) continue;
    const first = berlinToMs(day, time);
    for (let k = 0; k < count; k++) starts.push(first + k * (offer.durationMin + gap) * 60_000);
  }
  try {
    const r = createSlots(db(), offerId, starts);
    refresh();
    const skipped = r.skipped.length ? ` ${r.skipped.length} übersprungen (Vergangenheit oder Überschneidung).` : "";
    return { ok: `${r.created.length} Termin${r.created.length === 1 ? "" : "e"} freigegeben.${skipped}` };
  } catch (e) {
    return { error: bookingErr(e) };
  }
}

export async function closeSlotAction(form: FormData): Promise<void> {
  await requireTeacher();
  try {
    const msg = str(form, "message") || "Dieser Termin entfällt leider. Bitte wähle einen anderen freien Termin.";
    for (const b of closeSlot(db(), str(form, "slotId"), msg)) notifyStudent(b, "Anfrage abgelehnt", `${b.title} am ${when(b)}: ${msg}`);
  } catch (e) {
    console.error(bookingErr(e));
  }
  refresh();
}

function autoDeclineText(): string {
  return listTemplates(db(), "decline")[0]?.body ?? "Dieser Termin ist leider schon vergeben. Bitte wähle einen anderen freien Termin.";
}

export async function decideAction(_p: ActionState, form: FormData): Promise<ActionState> {
  await requireTeacher();
  const id = str(form, "bookingId"), decision = str(form, "decision"), message = str(form, "message");
  try {
    if (decision === "confirm") {
      const { booking: b, autoDeclined } = confirmBooking(db(), id, message, autoDeclineText());
      const pay = `Bitte bezahle ${formatPrice(b.priceCents)} bis ${fmtTime(b.payDeadline!)} Uhr, sonst wird der Termin wieder freigegeben.`;
      notifyStudent(b, b.slotId ? "Termin bestätigt – bitte bezahlen" : "Bestellung bestätigt – bitte bezahlen",
        `${message ? message + "\n\n" : ""}${b.title}${b.slotId ? ` am ${when(b)}` : ""}.\n${pay}`);
      for (const o of autoDeclined) notifyStudent(o, "Anfrage abgelehnt", `${o.title} am ${when(o)}: ${o.adminMessage}`);
      refresh();
      return { ok: `Bestätigt. ${b.userName} hat bis ${fmtTime(b.payDeadline!)} Uhr Zeit zum Bezahlen.` };
    }
    if (decision === "decline") {
      if (!message) return { error: "Bitte einen Grund auswählen oder schreiben." };
      const b = declineBooking(db(), id, message);
      notifyStudent(b, "Anfrage abgelehnt", `${b.title}${b.slotId ? ` am ${when(b)}` : ""}: ${message}`);
      if (b.kind && b.startsAt && b.endsAt) { releaseToWaitlist(db(), b.startsAt, b.endsAt, b.userId); runWaitlistJobs(); }
      refresh();
      return { ok: "Abgelehnt, die Nachricht wurde verschickt." };
    }
    return { error: "Bitte Bestätigen oder Ablehnen wählen." };
  } catch (e) {
    return { error: bookingErr(e) };
  }
}

export async function adminCancelAction(_p: ActionState, form: FormData): Promise<ActionState> {
  await requireTeacher();
  const message = str(form, "message");
  if (!message) return { error: "Bitte einen Grund auswählen oder schreiben." };
  try {
    const before = getBooking(db(), str(form, "bookingId"));
    const reopen = form.get("reopen") === "on";
    const { booking: b } = cancelByAdmin(db(), str(form, "bookingId"), { message, refund: false, reopenSlot: reopen });
    let moneyText = "";
    if (before?.status === "paid") {
      const { creditCents, moneyCents } = schoolCancelCredit(db(), b, form.get("money") === "on");
      if (moneyCents > 0) moneyText = await refundBooking(b, moneyCents);
      if (creditCents > 0) moneyText = `${formatPrice(creditCents)} sind als Guthaben auf deinem Konto.${moneyText ? " " + moneyText : ""}`;
    } else {
      releaseHold(db(), b.id);
    }
    notifyStudent(b, "Fahrt abgesagt", `${b.title}${b.slotId ? ` am ${when(b)}` : ""}: ${message}${moneyText ? `\n\n${moneyText}` : ""}`);
    if (reopen && b.startsAt && b.endsAt) { releaseToWaitlist(db(), b.startsAt, b.endsAt, b.userId); runWaitlistJobs(); }
    refresh();
    return { ok: "Abgesagt, der Schüler ist benachrichtigt." };
  } catch (e) {
    return { error: bookingErr(e) };
  }
}

/** Bar/EC in der Fahrschule bezahlt. */
export async function markPaidCashAction(form: FormData): Promise<void> {
  await requireTeacher();
  await finalizePayment(str(form, "bookingId"), "bar", `bar-${Date.now()}`, null);
  refresh();
}

export async function saveOfferAction(_p: ActionState, form: FormData): Promise<ActionState> {
  await requireTeacher();
  const price = parseEuro(str(form, "price"));
  if (!Number.isFinite(price)) return { error: "Preis bitte als Zahl, z. B. 65 oder 65,50." };
  try {
    const o = saveOffer(db(), {
      id: str(form, "id") || undefined,
      kind: (str(form, "kind") || "slot") as OfferKind,
      title: str(form, "title"), description: str(form, "description"),
      durationMin: Number(form.get("duration") ?? 0) | 0, priceCents: price,
      needsApproval: form.get("approval") === "on", active: form.get("active") === "on",
    });
    refresh();
    revalidatePath("/verwaltung", "layout");
    return { ok: `„${o.title}“ gespeichert.${o.active && o.priceCents === 0 ? " Hinweis: ohne Preis ist es nicht buchbar." : ""}` };
  } catch (e) {
    return { error: bookingErr(e) };
  }
}

export async function saveSettingsAction(_p: ActionState, form: FormData): Promise<ActionState> {
  await requireTeacher();
  saveSettings(db(), {
    payWindowMin: Number(form.get("payWindowMin")), freeCancelHours: Number(form.get("freeCancelHours")),
    minLeadHours: Number(form.get("minLeadHours")), maxOpenRequests: Number(form.get("maxOpenRequests")),
    cancelCutoffHour: Number(form.get("cancelCutoffHour")), lateChargePct: Number(form.get("lateChargePct")), noShowChargePct: Number(form.get("noShowChargePct")),
  });
  const tf = String(form.get("testfahrtMinutes") ?? "30") === "45" ? "45" : "30";
  db().prepare(`INSERT INTO settings (key,value) VALUES ('testfahrt_minutes', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(tf);
  revalidatePath("/verwaltung", "layout");
  refresh();
  return { ok: "Gespeichert." };
}

export async function saveTemplateAction(_p: ActionState, form: FormData): Promise<ActionState> {
  await requireTeacher();
  try {
    saveTemplate(db(), { id: str(form, "id") || undefined, kind: str(form, "kind") as TemplateKind, label: str(form, "label"), body: str(form, "body") });
    revalidatePath("/verwaltung", "layout");
    refresh();
    return { ok: "Vorlage gespeichert." };
  } catch (e) {
    return { error: bookingErr(e) };
  }
}

export async function deleteTemplateAction(form: FormData): Promise<void> {
  await requireTeacher();
  deleteTemplate(db(), str(form, "id"));
  revalidatePath("/verwaltung", "layout");
  refresh();
}

// ============ Guthaben (Fahrschule) =================================================

/** Guthaben gutschreiben (+) oder als ausgezahlt buchen (−). */
export async function adjustCreditAction(_p: ActionState, form: FormData): Promise<ActionState> {
  await requireTeacher();
  const userId = str(form, "userId");
  const u = getUser(db(), userId);
  if (!u) return { error: "Schüler nicht gefunden." };
  const cents = parseEuro(str(form, "amount"));
  if (!Number.isFinite(cents) || cents <= 0) return { error: "Bitte einen Betrag eintragen, z. B. 30 oder 45,50." };
  const payout = str(form, "type") === "payout";
  if (payout && cents > creditBalance(db(), userId)) return { error: "So viel Guthaben hat der Schüler nicht." };
  addCredit(db(), { userId, amountCents: payout ? -cents : cents, reason: payout ? "payout" : "manual", note: str(form, "note") });
  notifyUser(u, payout ? "Guthaben ausgezahlt" : "Guthaben gutgeschrieben",
    payout ? `${formatPrice(cents)} deines Guthabens wurden an dich ausgezahlt.` : `Die Fahrschule hat dir ${formatPrice(cents)} gutgeschrieben.${str(form, "note") ? ` (${str(form, "note")})` : ""}`, "/termine#guthaben");
  revalidatePath(`/verwaltung/schueler/${userId}`);
  return { ok: payout ? "Als ausgezahlt gebucht." : "Gutgeschrieben." };
}

// ============ Warteliste (Schüler) ===================================================

export async function addWaitlistAction(form: FormData): Promise<void> {
  const user = await requireUser();
  const toMin = (t: string) => { const m = /^(\d{1,2}):(\d{2})$/.exec(t); return m ? Number(m[1]) * 60 + Number(m[2]) : NaN; };
  let target = "/termine?warteliste=1#warteliste";
  try {
    const f = toMin(str(form, "from")), t = toMin(str(form, "to"));
    if (Number.isNaN(f) || Number.isNaN(t)) throw new BookingError("Bitte Uhrzeiten wählen.");
    addWaitlist(db(), user.id, str(form, "day"), f, t);
  } catch (e) {
    target = `/termine?fehler=${encodeURIComponent(bookingErr(e))}#warteliste`;
  }
  refresh();
  redirect(target);
}

export async function removeWaitlistAction(form: FormData): Promise<void> {
  const user = await requireUser();
  removeWaitlist(db(), user.id, str(form, "id"));
  refresh();
}
