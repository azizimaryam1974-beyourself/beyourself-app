import { auditRequest } from "@/lib/server/audit-context";
import { NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { getBooking } from "@/lib/server/booking";
import { getCheckout } from "@/lib/server/payments/stripe";
import { appReturnUrl, appUrl, finalizePayment } from "@/lib/server/payments/service";

/** Rückkehr von Stripe. Zahlung direkt prüfen (der Webhook kommt zusätzlich). */
export async function GET(req: Request) {
  void auditRequest(req, "GET /api/zahlung/stripe/zurueck");
  const u = new URL(req.url);
  const bookingId = u.searchParams.get("b") ?? "";
  const sessionId = u.searchParams.get("s") ?? "";
  // In der App: zurück in die App statt im Bezahl-Browser weiterzusurfen
  const go = (path: string) => NextResponse.redirect(u.searchParams.get("app") === "1" ? appReturnUrl(path) : `${appUrl()}${path}`, 303);
  const b = getBooking(db(), bookingId);
  if (!b || b.providerRef !== sessionId) return go("/termine");
  try {
    const s = await getCheckout(sessionId);
    if (s.client_reference_id === b.id && s.payment_status === "paid" && s.currency === "eur" && s.payment_intent) {
      const r = await finalizePayment(b.id, "stripe", s.payment_intent, s.amount_total);
      return go(`/termine?${r.ok ? "bezahlt=1" : "zahlung=problem"}`);
    }
  } catch (e) {
    console.error("[stripe] Rückkehr", (e as Error).message);
  }
  return go("/termine?zahlung=pruefen");
}
