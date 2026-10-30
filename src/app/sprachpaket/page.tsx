import { bookableLanguages } from "@/lib/languages";
import { formatPrice, LANGUAGE_PACKAGE_PRICE_CENTS } from "@/lib/language-package";

export const metadata = { title: "Sprachpaket-Bedingungen" };
export default function Terms() {
  return (
    <div className="card">
      <h1>Bedingungen für das Sprachpaket</h1>
      <div className="alert alert-info">VORLAGE – bitte rechtlich prüfen lassen (insb. Widerrufsbelehrung und Muster-Widerrufsformular).</div>
      <h2>Leistung</h2>
      <p>Live-Übersetzung des Theorieunterrichts der Fahrschule Be Yourself in die gewählte Sprache
        ({bookableLanguages().map((l) => l.labelDe).join(", ")}) als Text auf dem eigenen Gerät, optional mit Vorlesestimme,
        sowie Nachlesen vergangener Stunden. Gilt für die gesamte laufende Ausbildung.</p>
      <p>Die Übersetzung erfolgt maschinell. Sie ersetzt nicht das deutsche Original; maßgeblich für Prüfung und Verkehrsrecht ist der deutsche Unterricht.</p>
      <h2>Preis und Zahlung</h2>
      <p>{formatPrice(LANGUAGE_PACKAGE_PRICE_CENTS)} einmalig, inkl. gesetzlicher MwSt. Zahlung bar, mit EC-Karte oder per Überweisung an die Fahrschule.</p>
      <h2>Widerrufsrecht</h2>
      <p>[Widerrufsbelehrung einfügen.] Du hast ausdrücklich verlangt, dass die Leistung vor Ablauf der Widerrufsfrist beginnt.
        Widerrufst du nach Beginn, ist ein anteiliger Wertersatz zu zahlen; mit vollständiger Erbringung erlischt das Widerrufsrecht.</p>
    </div>
  );
}
