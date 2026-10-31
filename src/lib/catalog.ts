/**
 * Preisliste der Fahrschule – feste Positionen, jede genau einmal.
 * Preise und Texte ändert die Fahrschule unter Einstellungen → Preise & Leistungen.
 * Beschreibung: eine Zeile = ein Punkt „Was ist enthalten“.
 */
export interface CatalogItem {
  /** Angebot(e) in der Datenbank. Bei Prüfungen: [Fahrschule, TÜV]. */
  ids: string[];
  title: string;
  unit: string;
  /** Für wen / wann – kurzer Satz unter dem Titel. */
  who: string;
  defaults: { price: number[]; description: string };
}

/** Alte Fassung (31.10.) – wird ersetzt, solange die Fahrschule sie nicht selbst geändert hat. */
export const GRUND_DESC_V3 = [
  "Anmeldung, Ausbildungsvertrag und Verwaltung",
  "Hilfe beim Antrag bei der Führerscheinstelle",
  "Kompletter Theorieunterricht – so oft du möchtest",
  "Lernmaterial und Lern-App für die Theorieprüfung",
  "Dein Ausbildungsstand und Online-Buchung in der App",
].join("\n");

const GRUND_DESC = [
  "Inklusive Theorie-App zum Lernen für die Theorieprüfung (Handy und Computer)",
  "Inklusive Lernmaterial",
  "Inklusive kompletter Theorieunterricht – so oft du möchtest",
  "Inklusive Anmeldung, Ausbildungsvertrag und Verwaltung",
  "Inklusive Hilfe beim Antrag bei der Führerscheinstelle",
  "Inklusive App der Fahrschule: Ausbildungsstand, Online-Buchung, Nachrichten",
].join("\n");

export const CATALOG: CatalogItem[] = [
  {
    ids: ["fee-grundbetrag"], title: "Grundbetrag", unit: "einmalig",
    who: "Einmalig, für alle Klassen gleich – inklusive Theorie-App, Theorieunterricht, Lernmaterial und Verwaltung.",
    defaults: { price: [52000], description: GRUND_DESC },
  },
  {
    ids: ["drive-uebung"], title: "Übungsfahrt", unit: "je 45 Minuten",
    who: "Buchbar als 60, 75 oder 90 Minuten – der Preis wird genau anteilig berechnet.",
    defaults: { price: [6800], description: [
      "Fahrstunde mit deinem Fahrlehrer im Fahrschulauto",
      "Schaltwagen oder Automatik – je nach Klasse und Ausbildungsstand",
      "Auch für die Wiederholungsphase vor der Prüfung",
    ].join("\n") },
  },
  {
    ids: ["drive-sonder"], title: "Sonderfahrt", unit: "je 45 Minuten",
    who: "Pflicht für B, B197 und B78: 5 × Überland, 4 × Autobahn, 3 × Beleuchtung (je 45 Min).",
    defaults: { price: [7500], description: [
      "Überlandfahrt: Landstraßen außerhalb geschlossener Ortschaften",
      "Autobahnfahrt: Auffahren, Überholen, hohe Geschwindigkeit, Abfahren",
      "Beleuchtungsfahrt: Fahren bei Dunkelheit – nur buchbar, wenn es dunkel ist",
    ].join("\n") },
  },
  {
    ids: ["drive-testfahrt"], title: "Testfahrt (nur B197)", unit: "30 Minuten",
    who: "Nach den 10 Schaltstunden. Danach sind die Sonderfahrten freigeschaltet.",
    defaults: { price: [4500], description: [
      "Prüfung deiner Schaltkompetenz auf dem Schaltwagen",
      "Dein Fahrlehrer bestätigt das Ergebnis in der App",
    ].join("\n") },
  },
  {
    ids: ["drive-warmstunde"], title: "Warmstunde", unit: "30 Minuten",
    who: "Direkt vor der praktischen Prüfung. Den Termin legt die Fahrschule fest.",
    defaults: { price: [4500], description: [
      "Einfahren und Ruhe finden direkt vor der Prüfung",
      "Letzte Fragen klären, Fahrt zum Prüfungsort",
    ].join("\n") },
  },
  {
    ids: ["fee-pruefung", "fee-tuev-praxis"], title: "Praktische Prüfung", unit: "pro Prüfung",
    who: "Zwei Teile: die Leistung der Fahrschule und die Gebühr des TÜV.",
    defaults: { price: [20000, 12983], description: [
      "Fahrschule: Anmeldung beim TÜV und Terminabstimmung",
      "Fahrschule: Fahrschulauto und Begleitung durch deinen Fahrlehrer",
      "TÜV: Prüfungsgebühr – wird von uns 1:1 an den TÜV weitergeleitet",
    ].join("\n") },
  },
  {
    ids: ["fee-theorie", "fee-tuev-theorie"], title: "Theorieprüfung", unit: "pro Prüfung",
    who: "Zwei Teile: die Leistung der Fahrschule und die Gebühr des TÜV.",
    defaults: { price: [7000, 2499], description: [
      "Fahrschule: Anmeldung und Vorstellung zur Theorieprüfung",
      "TÜV: Prüfungsgebühr – wird von uns 1:1 an den TÜV weitergeleitet",
    ].join("\n") },
  },
  {
    ids: ["sprachpaket"], title: "Sprachpaket Live-Übersetzung", unit: "einmalig",
    who: "Freiwillig, bei der Anmeldung oder später buchbar.",
    defaults: { price: [3000], description: [
      "Jede Theoriestunde live übersetzt auf dein Handy",
      "Türkisch, Englisch, Russisch, Arabisch, Spanisch, Französisch",
      "Auf Wunsch vorgelesen; vergangene Stunden zum Nachlesen",
    ].join("\n") },
  },
];

export const CATALOG_IDS = CATALOG.flatMap((c) => c.ids);
export const PART_LABEL = ["Fahrschule", "TÜV"] as const;
