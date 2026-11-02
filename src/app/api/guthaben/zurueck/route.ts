import { auditRequest } from "@/lib/server/audit-context";
import { NextResponse } from "next/server";
import { appReturnUrl, appUrl } from "@/lib/server/payments/service";
import { getCheckout } from "@/lib/server/payments/stripe";
import { applyTopup } from "@/lib/server/topup";

/** Rückkehr von Stripe nach dem Aufladen – Zahlung direkt prüfen (der Webhook kommt zusätzlich). */
export async function GET(req: Request) {
  void auditRequest(req, "GET /api/guthaben/zurueck");
  const u = new URL(req.url);
  const id = u.searchParams.get("s") ?? "";
  const go = (path: string) => NextResponse.redirect(u.searchParams.get("app") === "1" ? appReturnUrl(path) : `${appUrl()}${path}`, 303);
  try {
    // Kein Login nötig: Die Zahlung wird direkt bei Stripe geprüft und dem Schüler aus den Stripe-Daten gutgeschrieben
    // (im In-App-Bezahlbrowser gibt es kein Login-Cookie). Doppelt aufrufen ist harmlos.
    if (id.startsWith("cs_")) {
      const s = await getCheckout(id);
      const r = await applyTopup(s);
      return go(`/termine?${r.ok ? "aufgeladen=1" : "aufladen=pruefen"}#guthaben`);
    }
  } catch (e) {
    console.error("[aufladen] Rückkehr", (e as Error).message);
  }
  return go("/termine?aufladen=pruefen#guthaben");
}
