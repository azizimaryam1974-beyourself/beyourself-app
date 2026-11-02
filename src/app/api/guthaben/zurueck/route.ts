import { auditRequest } from "@/lib/server/audit-context";
import { NextResponse } from "next/server";
import { currentUser } from "@/lib/server/auth";
import { appUrl } from "@/lib/server/payments/service";
import { getCheckout } from "@/lib/server/payments/stripe";
import { applyTopup } from "@/lib/server/topup";

/** Rückkehr von Stripe nach dem Aufladen – Zahlung direkt prüfen (der Webhook kommt zusätzlich). */
export async function GET(req: Request) {
  void auditRequest(req, "GET /api/guthaben/zurueck");
  const user = await currentUser();
  const id = new URL(req.url).searchParams.get("s") ?? "";
  try {
    const s = await getCheckout(id);
    if (user && s.metadata?.user === user.id) {
      const r = await applyTopup(s);
      return NextResponse.redirect(`${appUrl()}/termine?${r.ok ? "aufgeladen=1" : "aufladen=pruefen"}#guthaben`, 303);
    }
  } catch (e) {
    console.error("[aufladen] Rückkehr", (e as Error).message);
  }
  return NextResponse.redirect(`${appUrl()}/termine?aufladen=pruefen#guthaben`, 303);
}
