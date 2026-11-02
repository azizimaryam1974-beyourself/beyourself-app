import { auditRequest } from "@/lib/server/audit-context";
import { NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { getBooking } from "@/lib/server/booking";
import { getCheckout } from "@/lib/server/payments/stripe";
import { appUrl, finalizePayment } from "@/lib/server/payments/service";

/** Rückkehr von Stripe. Zahlung direkt prüfen (der Webhook kommt zusätzlich). */
export async function GET(req: Request) {
  void auditRequest(req, "GET /api/zahlung/stripe/zurueck");
  const u = new URL(req.url);
  const bookingId = u.searchParams.get("b") ?? "";
  const sessionId = u.searchParams.get("s") ?? "";
  const b = getBooking(db(), bookingId);
  if (!b || b.providerRef !== sessionId) return NextResponse.redirect(`${appUrl()}/termine`, 303);
  try {
    const s = await getCheckout(sessionId);
    if (s.client_reference_id === b.id && s.payment_status === "paid" && s.currency === "eur" && s.payment_intent) {
      const r = await finalizePayment(b.id, "stripe", s.payment_intent, s.amount_total);
      return NextResponse.redirect(`${appUrl()}/termine?${r.ok ? "bezahlt=1" : "zahlung=problem"}`, 303);
    }
  } catch (e) {
    console.error("[stripe] Rückkehr", (e as Error).message);
  }
  return NextResponse.redirect(`${appUrl()}/termine?zahlung=pruefen`, 303);
}
