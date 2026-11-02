import { bookableLanguages } from "./languages";
import { formatPrice, LANGUAGE_PACKAGE_PRICE_CENTS } from "./language-package";
import { SCHOOL, fullAddress } from "./school";

/**
 * Häufige Fragen – erscheinen auf der Startseite, als FAQ-Daten für Google und in /llms.txt für KI-Suchen.
 * Nur Aussagen, die stimmen und die wir belegen können (Unterlagen/Gebühren: Stadt Kassel, Stand 11/2026).
 */
export interface Faq { q: string; a: string }

export function faqs(): Faq[] {
  const langs = bookableLanguages().map((l) => l.labelDe);
  const langText = langs.length > 1 ? `${langs.slice(0, -1).join(", ")} und ${langs[langs.length - 1]}` : langs.join("");
  return [
    { q: "Wo ist die Fahrschule beyourself in Kassel?",
      a: `Die Fahrschule beyourself ist in der ${fullAddress}. Wir bilden Fahrschülerinnen und Fahrschüler aus Kassel und Umgebung aus, z. B. aus ${SCHOOL.areaServed.slice(1, 6).join(", ")}.` },
    { q: "Welche Führerscheinklassen bietet beyourself an?",
      a: "Klasse B (Pkw, Ausbildung und Prüfung auf dem Schaltwagen), B197 (Ausbildung und Prüfung auf Automatik, danach darfst du trotzdem Schaltwagen fahren), B78 (nur Automatik) und die Umschreibung ausländischer Führerscheine." },
    { q: "Was ist der Unterschied zwischen B, B197 und B78?",
      a: "Bei Klasse B lernst du und machst die Prüfung auf dem Schaltwagen. Bei B197 lernst du auf Automatik, fährst zusätzlich mindestens 10 Fahrstunden auf dem Schaltwagen und machst eine kurze Testfahrt – dann darfst du beides fahren. Bei B78 lernst und fährst du nur Automatik; Schaltwagen darfst du danach nicht fahren." },
    { q: "Kann ich den Theorieunterricht in meiner Sprache verstehen?",
      a: `Ja. Mit dem Sprachpaket (einmalig ${formatPrice(LANGUAGE_PACKAGE_PRICE_CENTS)}) liest du jeden Satz des Theorieunterrichts live übersetzt auf deinem Handy mit oder hörst ihn über Kopfhörer – auf ${langText}. Der Unterricht selbst findet auf Deutsch statt.` },
    { q: "Wie buche ich Fahrstunden?",
      a: "Online in deinem Konto: Du siehst die freien Termine, wählst einen aus und bezahlst direkt (Karte, Apple Pay, Google Pay) oder bar in der Fahrschule. Absagen geht ebenfalls online; rechtzeitig abgesagte Stunden werden dir als Guthaben gutgeschrieben." },
    { q: "Welche Unterlagen brauche ich für den Führerscheinantrag in Kassel?",
      a: "Für die Ersterteilung verlangt die Stadt Kassel: gültigen Personalausweis oder Reisepass (bei ausländischem Pass mit elektronischem Aufenthaltstitel), ein biometrisches Passbild auf Papier, einen Sehtest (nicht älter als 2 Jahre) und den Nachweis über einen Erste-Hilfe-Kurs mit 9 Unterrichtseinheiten (nur vor Ort, keine Online-Kurse). Deine Unterlagen kannst du bei uns im Konto hochladen – wir prüfen sie für dich." },
    { q: "Kann ich meinen ausländischen Führerschein in Kassel umschreiben lassen?",
      a: "Ja, wir bereiten dich gezielt auf die Prüfungen in Deutschland vor. Den Antrag stellst du persönlich bei der Führerscheinstelle der Stadt Kassel. Mitbringen: gültigen Pass oder Personalausweis mit elektronischem Aufenthaltstitel, ein biometrisches Passbild und deinen ausländischen Führerschein. Die Gebühr der Stadt liegt bei 37,50 € bzw. 45,10 €, wenn eine Prüfung nötig ist." },
    { q: "Wie melde ich mich an?",
      a: `Online unter ${SCHOOL.url}/anmelden – in wenigen Minuten. Danach siehst du in deinem Konto deinen Weg zum Führerschein, kannst Unterlagen hochladen, Fahrstunden buchen und der Fahrschule im Chat schreiben.` },
  ];
}
