import { auditRequest } from "@/lib/server/audit-context";
import { NextResponse } from "next/server";
import { currentUser } from "@/lib/server/auth";
import { appUrl } from "@/lib/server/payments/service";
import { createTopupCheckout, stripeEnabled } from "@/lib/server/payments/stripe";
import { parseTopupAmount, TOPUP_MAX_CENTS, TOPUP_MIN_CENTS } from "@/lib/server/topup";

/** Formular „Guthaben aufladen“ → Bezahlseite von Stripe. */
export async function POST(req: Request) {
  void auditRequest(req, "POST /api/guthaben/aufladen");
  const user = await currentUser();
  if (!user) return NextResponse.redirect(`${appUrl()}/login`, 303);
  const form = await req.formData();
  const back = (msg: string) => NextResponse.redirect(`${appUrl()}/termine?aufladen_fehler=${encodeURIComponent(msg)}#guthaben`, 303);
  if (!stripeEnabled()) return back("Online-Aufladen ist gerade nicht möglich. Bitte per Überweisung oder bar.");
  if (form.get("terms") !== "on") return back("Bitte bestätige die Hinweise zum Guthaben.");
  const own = String(form.get("own") ?? "").trim();
  const cents = parseTopupAmount(own || String(form.get("amount") ?? ""));
  if (cents == null) return back(`Bitte einen Betrag zwischen ${TOPUP_MIN_CENTS / 100} € und ${TOPUP_MAX_CENTS / 100} € eingeben.`);
  try {
    const s = await createTopupCheckout({ userId: user.id, amountCents: cents, email: user.email.endsWith("@invalid") ? "" : user.email, baseUrl: appUrl() });
    if (!s.url) throw new Error("Stripe hat keine Bezahlseite geliefert.");
    return NextResponse.redirect(s.url, 303);
  } catch (e) {
    console.error("[aufladen]", (e as Error).message);
    return back(`Die Bezahlseite konnte gerade nicht geöffnet werden. (${(e as Error).message.slice(0, 160)})`);
  }
}
