import { redirect } from "next/navigation";
import { currentUser } from "@/lib/server/auth";
import { bookableLanguages } from "@/lib/languages";
import { formatPrice, LANGUAGE_PACKAGE_PRICE_CENTS } from "@/lib/language-package";
import { SignupForm } from "./SignupForm";
import { db } from "@/lib/server/db";
import { getOffer } from "@/lib/server/booking";

export const metadata = { title: "Anmelden" };
export const dynamic = "force-dynamic";

export default async function SignupPage() {
  if (await currentUser()) redirect("/konto");
  const languages = bookableLanguages().map(({ code, labelDe, nativeLabel, rtl }) => ({ code, labelDe, nativeLabel, rtl }));
  return (
    <div className="narrow" style={{ margin: "0 auto" }}>
      <h1>Anmeldung</h1>
      <p className="hint">Lege dein Konto an – für Theorieunterricht, Fahrstunden und deinen Ausbildungsstand.</p>
      <SignupForm languages={languages} price={formatPrice(LANGUAGE_PACKAGE_PRICE_CENTS)} grundPrice={formatPrice(getOffer(db(), "fee-grundbetrag")?.priceCents || 52000).replace(",00", "")} />
    </div>
  );
}
