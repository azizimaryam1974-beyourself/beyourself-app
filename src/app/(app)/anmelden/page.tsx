import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/server/auth";
import { bookableLanguages } from "@/lib/languages";
import { formatPrice, LANGUAGE_PACKAGE_PRICE_CENTS } from "@/lib/language-package";
import { SignupForm } from "./SignupForm";
import { db } from "@/lib/server/db";
import { getOffer } from "@/lib/server/booking";

export const metadata = { title: "Anmelden – Fahrschüler werden", description: "Melde dich online bei der Fahrschule beyourself in Kassel an: Klasse wählen, Daten eingeben, fertig. Auf Wunsch mit Sprachpaket für den Theorieunterricht.", alternates: { canonical: "/anmelden" }, robots: { index: true, follow: true } };
export const dynamic = "force-dynamic";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ klasse?: string }> }) {
  const { klasse } = await searchParams;
  if (await currentUser()) redirect("/konto");
  const languages = bookableLanguages().map(({ code, labelDe, nativeLabel, rtl }) => ({ code, labelDe, nativeLabel, rtl }));
  return (
    <div className="narrow" style={{ margin: "0 auto" }}>
      <h1>Fahrschüler werden</h1>
      <p className="hint">Schon ein Konto? <Link href="/login">Hier einloggen</Link></p>
      <ol className="signup-steps">
        <li><strong>Anmelden</strong><span>Klasse wählen, Konto anlegen – dauert 2 Minuten.</span></li>
        <li><strong>Grundbetrag bezahlen</strong><span>Online oder bar in der Fahrschule. Ab dann Theorie-App und Theorieunterricht.</span></li>
        <li><strong>Fahrstunden buchen</strong><span>Direkt in deinem Konto – du siehst nur, was für dich gerade dran ist.</span></li>
      </ol>
      <SignupForm languages={languages} price={formatPrice(LANGUAGE_PACKAGE_PRICE_CENTS)} preset={klasse} grundPrice={formatPrice(getOffer(db(), "fee-grundbetrag")?.priceCents || 52000).replace(",00", "")} />
    </div>
  );
}
