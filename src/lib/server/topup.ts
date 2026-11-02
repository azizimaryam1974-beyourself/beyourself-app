import { db } from "./db";
import { addCredit, creditBalance } from "./credit";
import { getUser } from "./repo";
import { writeAudit } from "./audit";
import { formatPrice } from "@/lib/language-package";
import type { CheckoutSession } from "./payments/stripe";

/** Grenzen fürs Online-Aufladen (Maryam, 02.11.2026): 200 € bis 2.000 €. */
export const TOPUP_MIN_CENTS = 20_000;
export const TOPUP_MAX_CENTS = 200_000;

export function parseTopupAmount(input: string): number | null {
  const n = Number(String(input).replace(/\s|€/g, "").replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(n)) return null;
  const cents = Math.round(n * 100);
  return cents >= TOPUP_MIN_CENTS && cents <= TOPUP_MAX_CENTS ? cents : null;
}

/**
 * Bezahlte Aufladung gutschreiben. Doppelt aufgerufen (Rückkehr + Webhook) ist harmlos:
 * Pro Stripe-Sitzung gibt es genau einen Eintrag (eindeutige booking_id „topup:<Sitzung>“).
 */
export async function applyTopup(s: CheckoutSession): Promise<{ ok: boolean; userId?: string; cents?: number }> {
  const userId = s.metadata?.user ?? (s.client_reference_id?.startsWith("topup:") ? s.client_reference_id.slice(6) : "");
  if (s.metadata?.kind !== "topup" || !userId || s.payment_status !== "paid" || s.currency !== "eur" || !s.amount_total) return { ok: false };
  const u = getUser(db(), userId);
  if (!u) return { ok: false };
  const cents = s.amount_total;
  const added = addCredit(db(), { userId, bookingId: `topup:${s.id}`, amountCents: cents, reason: "deposit", note: "Online (Stripe)" });
  if (added) {
    writeAudit(db(), { kind: "payment", action: "Guthaben online aufgeladen", actor: { id: u.id, name: u.name, role: u.role }, target: `Stripe ${s.id}`, details: { betragCent: cents, zahlung: s.payment_intent } });
    const { notifyUser, notifySchool } = await import("./payments/service");
    notifyUser(u, "Guthaben aufgeladen", `Danke! ${formatPrice(cents)} sind auf deinem Guthaben angekommen. Dein Guthaben: ${formatPrice(creditBalance(db(), userId))}. Du kannst damit jetzt Grundbetrag, Fahrstunden und Prüfungen bezahlen.`, "/termine#guthaben");
    notifySchool(null, `Guthaben aufgeladen: ${u.name}`, `${u.name} hat ${formatPrice(cents)} online aufs Guthaben eingezahlt (Stripe).`);
  }
  return { ok: true, userId, cents };
}
