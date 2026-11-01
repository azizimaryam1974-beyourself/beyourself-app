import { NextResponse } from "next/server";
import { currentUser } from "@/lib/server/auth";
import { appUrl, PaymentError, startPayment, type Provider } from "@/lib/server/payments/service";

/** Formular "Jetzt bezahlen" → weiter zur Bezahlseite von Stripe / PayPal. */
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.redirect(`${appUrl()}/login`, 303);
  const form = await req.formData();
  const bookingId = String(form.get("b") ?? "");
  const provider = String(form.get("provider") ?? "") as Provider;
  const back = (msg: string) => NextResponse.redirect(`${appUrl()}/termine?fehler=${encodeURIComponent(msg)}#offen`, 303);
  if (form.get("terms") !== "on") return back("Bitte bestätige die Buchungsbedingungen.");
  try {
    const url = await startPayment(bookingId, user.id, provider);
    return NextResponse.redirect(url, 303);
  } catch (e) {
    if (e instanceof PaymentError) return back(e.message);
    console.error("[zahlung] Start fehlgeschlagen", (e as Error).message);
    const detail = (e as Error).message.startsWith("Stripe") ? ` (${(e as Error).message.slice(0, 200)})` : "";
    return back(`Die Bezahlseite konnte gerade nicht geöffnet werden. Bitte versuche es gleich noch einmal oder wähle eine andere Zahlart.${detail}`);
  }
}
