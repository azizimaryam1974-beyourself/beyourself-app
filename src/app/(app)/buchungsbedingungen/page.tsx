import { db } from "@/lib/server/db";
import { getSettings } from "@/lib/server/booking";

export const metadata = { title: "Buchungsbedingungen", description: "Buchungs-, Zahlungs- und Absagebedingungen der Fahrschule beyourself in Kassel.", alternates: { canonical: "/buchungsbedingungen" }, robots: { index: true, follow: true } };
export const dynamic = "force-dynamic";

export default function TermsPage() {
  const s = getSettings(db());
  return (
    <article className="card prose">
      <div className="alert alert-info">Entwurf – wird vor dem Start rechtlich geprüft.</div>
      <h1>Buchungsbedingungen für Online-Buchungen</h1>
      <h2>1. Ablauf</h2>
      <p>Du buchst eine freie Zeit, die zu deinem Ausbildungsstand passt. Die Zeit ist sofort für dich reserviert; du hast {s.payWindowMin} Minuten
        Zeit zum Bezahlen. Erst mit der Zahlung ist die Fahrt verbindlich gebucht. Geht keine Zahlung ein, wird die Zeit wieder freigegeben.</p>
      <h2>2. Preise, Zahlung und Guthaben</h2>
      <p>Alle Preise in Euro inkl. gesetzlicher Mehrwertsteuer. Zahlung per Karte, Apple Pay, Google Pay oder PayPal über unsere
        Zahlungsdienstleister (Stripe, PayPal). Die Fahrschule erhält keine Karten- oder Kontodaten. Beträge aus Absagen werden dir als
        Guthaben gutgeschrieben und bei der nächsten Buchung automatisch verrechnet.</p>
      <h2>3. Absage durch dich</h2>
      <ul>
        <li>Kostenlos bis {s.freeCancelHours} Stunden vor Beginn, spätestens bis {s.cancelCutoffHour}:00 Uhr am Vortag – der volle Betrag wird dir gutgeschrieben.</li>
        <li>Danach (kurzfristige Absage): {s.lateChargePct} % des Preises werden berechnet, der Rest wird gutgeschrieben. Wird der Termin von jemand anderem übernommen, bekommst du auch die berechneten {s.lateChargePct} % gutgeschrieben.</li>
        <li>Termine, die weniger als {s.freeCancelHours} Stunden vor Beginn gebucht wurden (Last-Minute), können nicht abgesagt werden.</li>
        <li>Erscheinst du nicht oder kommst du mehr als 15 Minuten zu spät, fällt die Fahrt aus; {s.noShowChargePct} % des Preises werden berechnet, der Rest wird gutgeschrieben.</li>
      </ul>
      <h2>4. Absage durch die Fahrschule</h2>
      <p>Muss die Fahrschule einen Termin absagen (z. B. Krankheit, Fahrzeugausfall, Unwetter), erhältst du den vollen Betrag als Guthaben
        oder auf Wunsch zurück auf dein Zahlungsmittel.</p>
      <h2>5. Warteliste</h2>
      <p>Du kannst dich pro Woche für einen Tag auf die Warteliste setzen. Wird eine passende Zeit frei, wird die erste Person benachrichtigt
        und kann sie 30 Minuten lang exklusiv buchen; danach ist sie für alle buchbar. Zwischen 22 und 7 Uhr werden keine Nachrichten verschickt.</p>
      <h2>6. Grundbetrag und Prüfungen</h2>
      <ul>
        <li>Der Grundbetrag wird mit der Anmeldung fällig. Fahrstunden können gebucht werden, sobald er bezahlt ist.</li>
        <li>Prüfungstermine legt die Fahrschule nach Bestätigung durch den TÜV fest. Du bestätigst den Termin verbindlich, indem du
          die Gebühren bis zur genannten Frist bezahlst. Ohne Zahlung verfällt die Einladung.</li>
        <li>Die TÜV-Gebühren zieht die Fahrschule für den TÜV ein und leitet sie unverändert weiter; sie werden getrennt ausgewiesen.</li>
        <li>Erscheinst du zu einem bestätigten Prüfungstermin nicht, verfallen die bezahlten Gebühren.</li>
        <li>Verschiebt oder storniert die Fahrschule oder der TÜV den Termin, erhältst du den vollen Betrag als Guthaben; er wird beim
          neuen Termin automatisch verrechnet.</li>
      </ul>
      <h2>7. Guthaben am Ende der Ausbildung</h2>
      <p>Nicht verbrauchtes Guthaben wird dir am Ende der Ausbildung auf Wunsch ausgezahlt.</p>
      <h2>8. Widerrufsrecht</h2>
      <p>Verbraucher haben ein gesetzliches Widerrufsrecht von 14 Tagen. Mit der Buchung verlangst du ausdrücklich, dass wir vor Ablauf
        der Widerrufsfrist mit der Leistung beginnen. Dein Widerrufsrecht erlischt, wenn die Leistung vollständig erbracht ist.
        Die vollständige Widerrufsbelehrung folgt.</p>
    </article>
  );
}
