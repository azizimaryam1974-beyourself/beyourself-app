import { db } from "@/lib/server/db";
import { getSettings } from "@/lib/server/booking";

export const metadata = { title: "Buchungsbedingungen" };
export const dynamic = "force-dynamic";

export default function TermsPage() {
  const s = getSettings(db());
  return (
    <article className="card prose">
      <div className="alert alert-info">Entwurf – wird vor dem Start rechtlich geprüft.</div>
      <h1>Buchungsbedingungen für Online-Buchungen</h1>
      <h2>1. Ablauf</h2>
      <p>Du fragst einen freien Termin an. Die Fahrschule bestätigt oder lehnt ab. Nach der Bestätigung hast du {s.payWindowMin} Minuten
        Zeit zum Bezahlen. Erst mit der Zahlung ist der Termin verbindlich für dich reserviert. Geht keine Zahlung ein, wird der Termin
        wieder für andere freigegeben.</p>
      <h2>2. Preise und Zahlung</h2>
      <p>Alle Preise in Euro inkl. gesetzlicher Mehrwertsteuer. Zahlung per Karte, Apple Pay, Google Pay oder PayPal über unsere
        Zahlungsdienstleister (Stripe, PayPal). Die Fahrschule erhält keine Karten- oder Kontodaten.</p>
      <h2>3. Absage durch dich</h2>
      <p>Bezahlte Termine kannst du bis {s.freeCancelHours} Stunden vor Beginn online kostenlos absagen; du erhältst den vollen Betrag
        zurück. Bei späterer Absage oder Nichterscheinen wird die Fahrstunde berechnet, es sei denn, du hast den Ausfall nicht zu vertreten.</p>
      <h2>4. Absage durch die Fahrschule</h2>
      <p>Muss die Fahrschule einen Termin absagen (z. B. Krankheit, Fahrzeugausfall, Unwetter), erhältst du den vollen Betrag zurück
        oder einen Ersatztermin.</p>
      <h2>5. Widerrufsrecht</h2>
      <p>Verbraucher haben ein gesetzliches Widerrufsrecht von 14 Tagen. Mit der Buchung verlangst du ausdrücklich, dass wir vor Ablauf
        der Widerrufsfrist mit der Leistung beginnen. Dein Widerrufsrecht erlischt, wenn die Leistung vollständig erbracht ist.
        Die vollständige Widerrufsbelehrung folgt.</p>
    </article>
  );
}
