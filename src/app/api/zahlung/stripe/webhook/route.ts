import { auditRequest } from "@/lib/server/audit-context";
import { NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { firstTimeEvent } from "@/lib/server/booking";
import { verifyWebhook, type CheckoutSession } from "@/lib/server/payments/stripe";
import { finalizePayment } from "@/lib/server/payments/service";

/**
 * Stripe meldet Zahlungen hierher (auch wenn der Schüler den Browser vorher schließt).
 * Im Stripe-Dashboard: Webhook auf https://fahrschule-beyourself.de/api/zahlung/stripe/webhook
 * mit den Ereignissen checkout.session.completed und checkout.session.async_payment_succeeded.
 */
export async function POST(req: Request) {
  void auditRequest(req, "POST /api/zahlung/stripe/webhook");
  const payload = await req.text();
  if (!verifyWebhook(payload, req.headers.get("stripe-signature"), process.env.STRIPE_WEBHOOK_SECRET ?? "")) {
    return NextResponse.json({ error: "Signatur ungültig" }, { status: 400 });
  }
  const event = JSON.parse(payload) as { id: string; type: string; data: { object: CheckoutSession } };
  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const s = event.data.object;
    if (s.payment_status === "paid" && s.client_reference_id && s.payment_intent && s.currency === "eur") {
      if (firstTimeEvent(db(), `stripe:${event.id}`)) {
        await finalizePayment(s.client_reference_id, "stripe", s.payment_intent, s.amount_total);
      }
    }
  }
  return NextResponse.json({ received: true });
}
