import { db } from "../db";
import { writeAudit } from "../audit";
import { sendMail } from "../mail";
import {
  addNotification, dueForReminder, expireDue, getBooking, markPaid, noteRefundProblem, setPaymentRef,
  type Booking, type MarkPaidResult,
} from "../booking";
import { formatPrice } from "@/lib/language-package";
import { fmtSlot, fmtTime } from "@/lib/time";
import * as stripe from "./stripe";
import * as paypal from "./paypal";
import { creditBalance, holdCredit, releaseHold } from "../credit";
import { creditRefills } from "../cancel";
import { releaseToWaitlist } from "../drive-booking";
import { dueHoldNotifications, purgeOldWaitlist, takeExpiredHolds, waitersFor } from "../waitlist";
import { getUser } from "../repo";
import { confirmExamPaid, EXAM_LABEL, examsDueForReminder, expireExams, getExam } from "../exams";
import { fmtDay } from "@/lib/time";

export type Provider = "stripe" | "paypal" | "test" | "guthaben";

/** Kommt die Anfrage aus der beyourself-App (Kennung im User-Agent)? */
export function isAppRequest(req: Request): boolean {
  return /beyourselfApp\//.test(req.headers.get("user-agent") ?? "");
}

/** Zurück in die App springen (schließt den In-App-Browser von Stripe), Ziel-Seite wird dort geöffnet. */
export function appReturnUrl(path: string): string {
  return `beyourself://zurueck?ziel=${encodeURIComponent(path)}`;
}

export function appUrl(): string {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

/** Testzahlung nur, wenn ausdrücklich eingeschaltet (nie aus Versehen live). */
export function testPaymentsEnabled(): boolean {
  return process.env.PAYMENTS_TEST_MODE === "1";
}

export function availableProviders(): Provider[] {
  const p: Provider[] = [];
  if (stripe.stripeEnabled()) p.push("stripe");
  if (paypal.paypalEnabled()) p.push("paypal");
  if (testPaymentsEnabled()) p.push("test");
  return p;
}

// ---------- Benachrichtigungen ---------------------------------------------

export function when(b: Booking): string {
  return b.startsAt && b.endsAt ? fmtSlot(b.startsAt, b.endsAt) : "";
}

/** Nachricht ins Konto + E-Mail an den Schüler. */
export function notifyStudent(b: Booking, title: string, body: string): void {
  addNotification(db(), b.userId, b.id, title, body);
  if (b.userEmail && !b.userEmail.endsWith("@invalid")) {
    sendMail(b.userEmail, `${title} – Fahrschule beyourself`,
      `Hallo ${b.userName?.split(" ")[0] ?? ""},\n\n${body}\n\nDeine Termine: ${appUrl()}/termine\n\nViele Grüße\nFahrschule beyourself`);
  }
}

/** Nachricht an einen Schüler ohne Buchungsbezug (z. B. Ausbildungsstand). */
export function notifyUser(user: { id: string; email: string; name: string }, title: string, body: string, link = "/konto"): void {
  addNotification(db(), user.id, null, title, body);
  if (!user.email.endsWith("@invalid")) {
    sendMail(user.email, `${title} – Fahrschule beyourself`,
      `Hallo ${user.name.split(" ")[0]},\n\n${body}\n\n${appUrl()}${link}\n\nViele Grüße\nFahrschule beyourself`);
  }
}

/** Nachricht an alle Lehrkräfte (Konto) + E-Mail an die Fahrschul-Adresse. */
export function notifySchool(b: Booking | null, title: string, body: string): void {
  const teachers = db().prepare(`SELECT id FROM users WHERE role = 'teacher'`).all() as Array<{ id: string }>;
  for (const t of teachers) addNotification(db(), t.id, b?.id ?? null, title, body);
  const to = process.env.ADMIN_EMAIL || "info@fahrschule-beyourself.de";
  sendMail(to, title, `${body}\n\nKalender: ${appUrl()}/verwaltung/kalender`);
}

// ---------- Bezahlen starten -------------------------------------------------

export class PaymentError extends Error {}

/** Liefert die Adresse der Bezahlseite (Stripe/PayPal) für eine bestätigte Buchung. */
export async function startPayment(bookingId: string, userId: string, provider: Provider, app = false): Promise<string> {
  const b = getBooking(db(), bookingId);
  if (!b || b.userId !== userId) throw new PaymentError("Buchung nicht gefunden.");
  if (b.status !== "awaiting_payment") throw new PaymentError("Für diese Buchung ist keine Zahlung offen.");
  if (!b.payDeadline || b.payDeadline < Date.now()) throw new PaymentError("Die Zahlungsfrist ist abgelaufen.");
  if (provider !== "guthaben" && !availableProviders().includes(provider)) throw new PaymentError("Diese Zahlart ist nicht verfügbar.");
  const now = Date.now();
  const description = when(b);
  // Vorhandenes Guthaben wird immer zuerst verrechnet.
  const credit = holdCredit(db(), userId, b.id, b.priceCents, now);
  const toPay = b.priceCents - credit;
  if (toPay <= 0) {
    const r = await finalizePayment(b.id, "guthaben", `guthaben-${now}`, 0);
    return `${appUrl()}/termine?${r.ok ? "bezahlt=1" : "zahlung=problem"}`;
  }
  if (provider === "guthaben") throw new PaymentError(`Dein Guthaben reicht nicht ganz – es fehlen ${formatPrice(toPay)}. Bitte wähle eine Zahlart.`);

  if (provider === "stripe") {
    // Offene Bezahlseite wiederverwenden (Schüler klickt zweimal / kommt zurück).
    if (!app && b.provider === "stripe" && b.providerRef) {
      try {
        const s = await stripe.getCheckout(b.providerRef);
        if (s.status === "open" && s.url) return s.url;
      } catch { /* neu anlegen */ }
    }
    const s = await stripe.createCheckout({
      bookingId: b.id, title: b.title, description, amountCents: toPay, email: b.userEmail ?? "", expiresAt: b.payDeadline, baseUrl: appUrl(), app,
    });
    setPaymentRef(db(), b.id, "stripe", s.id, now);
    if (!s.url) throw new PaymentError("Stripe hat keine Bezahlseite geliefert.");
    return s.url;
  }
  if (provider === "paypal") {
    const o = await paypal.createOrder({ bookingId: b.id, title: description ? `${b.title} · ${description}` : b.title, amountCents: toPay, baseUrl: appUrl() });
    setPaymentRef(db(), b.id, "paypal", o.id, now);
    return o.approveUrl;
  }
  setPaymentRef(db(), b.id, "test", `test-${now}`, now);
  return `${appUrl()}/termine/testzahlung/${b.id}`;
}

// ---------- Zahlung eingegangen ----------------------------------------------

export async function finalizePayment(bookingId: string, provider: Provider | "bar", paymentRef: string, amountCents: number | null): Promise<MarkPaidResult> {
  const res = markPaid(db(), bookingId, { provider, paymentRef, amountCents });
  writeAudit(db(), { kind: "payment", action: res.ok ? (res.already ? "Zahlung erneut gemeldet (schon bezahlt)" : "Zahlung eingegangen") : "Zahlung konnte nicht verbucht werden",
    target: `Buchung ${bookingId}`, ok: res.ok, details: { anbieter: provider, referenz: paymentRef, betragCent: amountCents, schueler: res.ok ? res.booking.userName : undefined, leistung: res.ok ? res.booking.title : undefined } });
  if (res.ok) {
    if (!res.already && res.booking.examId) {
      const b = res.booking;
      const e = confirmExamPaid(db(), b.id);
      if (e) {
        const warm = e.warmAt ? ` Warmstunde ab ${fmtTime(e.warmAt)} Uhr (Treffpunkt: ${b.meetingPoint || "Fahrschule"}).` : "";
        notifyStudent(b, `${EXAM_LABEL[e.type]} bestätigt`, `Danke! Deine Zahlung über ${formatPrice(b.priceCents)} ist angekommen. Deine ${EXAM_LABEL[e.type]} am ${fmtDay(e.startsAt)} um ${fmtTime(e.startsAt)} Uhr (${e.place}) ist verbindlich.${warm}\n\nBitte bring deinen Personalausweis oder Reisepass mit. Viel Erfolg!`);
        notifySchool(b, `Prüfung bestätigt: ${b.userName}`, `${b.userName} hat die ${EXAM_LABEL[e.type]} am ${fmtDay(e.startsAt)} ${fmtTime(e.startsAt)} Uhr bestätigt und ${formatPrice(b.priceCents)} bezahlt (${provider}).`);
      }
      return res;
    }
    if (!res.already) {
      const b = res.booking;
      const w = when(b);
      notifyStudent(b, "Bezahlt – alles fest", w
        ? `Deine Zahlung über ${formatPrice(b.priceCents)} ist angekommen. Dein Termin „${b.title}“ am ${w} ist fest gebucht.`
        : `Deine Zahlung über ${formatPrice(b.priceCents)} für „${b.title}“ ist angekommen. Danke!`);
      notifySchool(b, `Bezahlt: ${b.userName} · ${b.title}`, `${b.userName} hat ${formatPrice(b.priceCents)} bezahlt (${provider}${b.creditCents ? `, davon ${formatPrice(b.creditCents)} Guthaben` : ""}). ${w}`);
      // Termin nach später Absage neu besetzt → Ausfallgebühr des anderen Schülers zurück als Guthaben
      for (const r of creditRefills(db(), b)) {
        const u = getUser(db(), r.userId);
        if (u) notifyUser(u, "Gute Nachricht: Termin neu besetzt", `Dein abgesagter Termin wurde von jemand anderem übernommen. Dafür bekommst du ${formatPrice(r.cents)} als Guthaben zurück.`, "/termine#guthaben");
      }
    }
    return res;
  }
  const b = res.booking;
  if (b && res.reason === "conflict" && provider !== "bar" && amountCents) {
    // Termin war schon an jemand anderen vergeben → Geld automatisch zurück.
    const ok = await refundRaw(provider, paymentRef, amountCents, `conflict-${b.id}`);
    notifyStudent(b, "Termin leider schon vergeben", `Deine Zahlung kam nach Ablauf der Frist an, der Termin war da schon vergeben. ${ok ? "Du bekommst das Geld automatisch zurück." : "Die Fahrschule zahlt dir das Geld zurück."}`);
    notifySchool(b, `Zahlung zu spät: ${b.userName}`, `Zahlung für ${b.title} kam nach der Frist an. ${ok ? "Automatisch erstattet." : "BITTE MANUELL ERSTATTEN – automatische Rückzahlung fehlgeschlagen."}`);
  } else if (b && res.reason === "amount" && b.status === "expired" && provider !== "bar" && amountCents) {
    // Frist war abgelaufen und das Guthaben schon zurückgebucht → Zahlung automatisch zurück.
    const ok = await refundRaw(provider, paymentRef, amountCents, `late-${b.id}`);
    notifyStudent(b, "Zahlung kam zu spät", `Deine Zahlung kam nach Ablauf der Frist an. ${ok ? "Du bekommst das Geld automatisch zurück." : "Die Fahrschule zahlt dir das Geld zurück."} Bitte buche den Termin neu, falls er noch frei ist.`);
  } else if (b && res.reason === "amount") {
    notifySchool(b, `Zahlung mit falschem Betrag: ${b.userName}`, `Für ${b.title} kam ${amountCents} Cent statt ${b.priceCents} Cent an. Bitte prüfen (${provider} ${paymentRef}).`);
  }
  return res;
}

async function refundRaw(provider: string, paymentRef: string, cents: number, key: string): Promise<boolean> {
  try {
    if (provider === "stripe") await stripe.refund(paymentRef, cents, key);
    else if (provider === "paypal") await paypal.refundCapture(paymentRef, cents, key);
    else if (provider !== "test") return false;
    return true;
  } catch (e) {
    console.error("[zahlung] Rückzahlung fehlgeschlagen", (e as Error).message);
    return false;
  }
}

/** Erstattung nach Absage. Gibt einen Text für die Nachricht zurück. */
export async function refundBooking(b: Booking, cents: number): Promise<string> {
  if (cents <= 0) return "";
  if (b.provider === "bar" || !b.providerPayment) {
    return `Den Betrag von ${formatPrice(cents)} bekommst du von der Fahrschule zurück.`;
  }
  const ok = await refundRaw(b.provider ?? "", b.providerPayment, cents, `cancel-${b.id}`);
  if (!ok) {
    noteRefundProblem(db(), b.id, "automatisch fehlgeschlagen – bitte manuell erstatten");
    notifySchool(b, `Rückzahlung fehlgeschlagen: ${b.userName}`, `Bitte ${formatPrice(cents)} für ${b.title} manuell erstatten (${b.provider}).`);
    return `Den Betrag von ${formatPrice(cents)} bekommst du von der Fahrschule zurück.`;
  }
  return `Die ${formatPrice(cents)} gehen automatisch an dich zurück (je nach Bank 3–10 Tage).`;
}

// ---------- Hintergrund: Fristen & Erinnerungen --------------------------------

export async function runBookingJobs(now = Date.now()): Promise<void> {
  for (const b of dueForReminder(db(), 10 * 60_000, now)) {
    notifyStudent(b, "Noch 10 Minuten zum Bezahlen", `Bitte bezahle deinen Termin „${b.title}“ (${when(b)}) bis ${fmtTime(b.payDeadline!)} Uhr – sonst wird er wieder für andere freigegeben.`);
  }
  for (const b of examsDueForReminder(db(), now)) {
    const e = b.examId ? getExam(db(), b.examId) : undefined;
    if (e) notifyStudent(b, `Bitte ${EXAM_LABEL[e.type]} bestätigen`, `Deine Einladung zur ${EXAM_LABEL[e.type]} am ${fmtDay(e.startsAt)} um ${fmtTime(e.startsAt)} Uhr gilt erst, wenn du bezahlt hast – bis ${fmtDay(b.payDeadline!)}, ${fmtTime(b.payDeadline!)} Uhr. Danach verfällt der Termin.`);
  }
  for (const b of expireDue(db(), now)) {
    if (b.provider === "stripe" && b.providerRef) await stripe.expireCheckout(b.providerRef);
    releaseHold(db(), b.id, now);
    if (b.kind && b.startsAt && b.endsAt) releaseToWaitlist(db(), b.startsAt, b.endsAt, b.userId, now);
    if (b.slotId) {
      notifyStudent(b, "Zahlungsfrist abgelaufen", `Für „${b.title}“ (${when(b)}) ist keine Zahlung eingegangen. Der Termin ist wieder frei für andere. Du kannst ihn gern erneut anfragen, falls er noch frei ist.`);
      notifySchool(b, `Frist abgelaufen: ${b.userName}`, `${b.userName} hat ${b.title} (${when(b)}) nicht bezahlt. Der Termin ist wieder frei.`);
    }
  }
  for (const e of expireExams(db(), now)) {
    const u = getUser(db(), e.userId);
    if (u) notifyUser(u, `${EXAM_LABEL[e.type]}: Frist abgelaufen`, `Für deine ${EXAM_LABEL[e.type]} am ${fmtDay(e.startsAt)} ist keine Zahlung eingegangen. Die Einladung ist verfallen – bitte melde dich bei der Fahrschule.`, "/termine");
    notifySchool(null, `Prüfung nicht bestätigt: ${u?.name ?? ""}`, `${u?.name ?? "Ein Schüler"} hat die ${EXAM_LABEL[e.type]} am ${fmtDay(e.startsAt)} ${fmtTime(e.startsAt)} Uhr nicht rechtzeitig bezahlt. Bitte beim TÜV absagen oder neu einladen.`);
  }
  runWaitlistJobs(now);
}

/** Warteliste: Platz 1 benachrichtigen, abgelaufene Reservierungen an alle weitergeben. */
export function runWaitlistJobs(now = Date.now()): void {
  const d = db();
  for (const h of dueHoldNotifications(d, now)) {
    const u = getUser(d, h.userId);
    if (u) notifyUser(u, "Termin frei – nur für dich",
      `Von der Warteliste: ${fmtSlot(h.startsAt, h.endsAt)} ist frei geworden. Bis ${fmtTime(h.expiresAt)} Uhr kannst nur du diese Zeit buchen – danach sehen sie alle.`, "/termine#buchen");
  }
  for (const h of takeExpiredHolds(d, now)) {
    if (h.startsAt <= now) continue;
    for (const w of waitersFor(d, h.startsAt, h.endsAt, h.userId)) {
      const u = getUser(d, w.userId);
      if (u) notifyUser(u, "Termin frei – wer zuerst bucht", `Von der Warteliste: Am ${fmtSlot(h.startsAt, h.endsAt)} ist Zeit frei geworden. Wer zuerst bucht, bekommt sie.`, "/termine#buchen");
    }
  }
  purgeOldWaitlist(d, now);
}

export { creditBalance };
