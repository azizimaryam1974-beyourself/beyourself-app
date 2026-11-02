import { auditRequest } from "@/lib/server/audit-context";
import { NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { getBooking } from "@/lib/server/booking";
import { captureOrder } from "@/lib/server/payments/paypal";
import { appUrl, finalizePayment } from "@/lib/server/payments/service";

/** Rückkehr von PayPal (Parameter "token" = Bestell-Nummer) → Zahlung einziehen. */
export async function GET(req: Request) {
  void auditRequest(req, "GET /api/zahlung/paypal/zurueck");
  const u = new URL(req.url);
  const bookingId = u.searchParams.get("b") ?? "";
  const orderId = u.searchParams.get("token") ?? "";
  const b = getBooking(db(), bookingId);
  if (!b || b.provider !== "paypal" || b.providerRef !== orderId) return NextResponse.redirect(`${appUrl()}/termine`, 303);
  if (b.status === "paid") return NextResponse.redirect(`${appUrl()}/termine?bezahlt=1`, 303);
  try {
    const cap = await captureOrder(orderId);
    if (cap.bookingId !== b.id) throw new Error("Bestellung gehört zu einer anderen Buchung");
    const r = await finalizePayment(b.id, "paypal", cap.captureId, cap.amountCents);
    return NextResponse.redirect(`${appUrl()}/termine?${r.ok ? "bezahlt=1" : "zahlung=problem"}`, 303);
  } catch (e) {
    console.error("[paypal] Rückkehr", (e as Error).message);
    return NextResponse.redirect(`${appUrl()}/termine?fehler=${encodeURIComponent("Die PayPal-Zahlung wurde nicht abgeschlossen. Es wurde nichts abgebucht.")}`, 303);
  }
}
