/** Führerscheinklassen – Inhalte für Startseite, Straßenschilder und Klassen-Seiten. */
export type TurnDirection = "left" | "right" | "straight";

export interface LicenseClass {
  slug: string;
  k: string;
  name: string;
  /** Text auf dem Straßenschild */
  sign: string;
  short: string;
  long: string[];
  turn: TurnDirection;
}

export const LICENSE_CLASSES: LicenseClass[] = [
  {
    slug: "b",
    k: "B",
    name: "Pkw",
    sign: "Klasse B",
    turn: "left",
    short: "Der klassische Führerschein für Auto bis 3,5 t. Mit Schaltwagen oder Automatik.",
    long: [
      "Mit Klasse B fährst du Pkw bis 3,5 t und bis zu 8 Mitfahrende. Anhänger bis 750 kg sind auch dabei.",
      "Du lernst Theorie und Praxis bei uns in Ruhe und in deinem Tempo – mit Übungsfahrten, Sonderfahrten über Land, Autobahn und bei Nacht und einer Prüfungsvorbereitung, die Sicherheit gibt.",
    ],
  },
  {
    slug: "b197",
    k: "B197",
    name: "Automatik mit Schaltberechtigung",
    sign: "B197 Automatik",
    turn: "right",
    short: "Ausbildung überwiegend auf Automatik – und trotzdem darfst du später Schaltwagen fahren.",
    long: [
      "Du lernst entspannt auf dem Automatik-Auto und machst die Prüfung auch dort. Nach mindestens 10 Fahrstunden auf dem Schaltwagen und einer kurzen Testfahrt darfst du trotzdem Schaltwagen fahren.",
      "Ideal, wenn du dich voll auf den Verkehr konzentrieren möchtest statt auf Kupplung und Gang.",
    ],
  },
  {
    slug: "be",
    k: "BE",
    name: "Anhänger",
    sign: "BE Anhänger",
    turn: "straight",
    short: "Für Wohnwagen, Pferdeanhänger und alles, was mehr als 750 kg zieht.",
    long: [
      "Mit BE ziehst du Anhänger bis 3,5 t hinter deinem Pkw – für Wohnwagen, Pferdeanhänger oder den Umzug.",
      "Wir üben Ankuppeln, Rangieren und Rückwärtsfahren so lange, bis es entspannt klappt.",
    ],
  },
];

export const EXTRA_CLASSES = [
  {
    slug: "umschreibung",
    k: "Umschreibung",
    name: "Ausländischer Führerschein",
    short: "Du hast schon einen Führerschein aus dem Ausland? Wir bereiten dich gezielt auf die Prüfungen in Deutschland vor.",
  },
];

export function getLicenseClass(slug: string): LicenseClass | undefined {
  return LICENSE_CLASSES.find((c) => c.slug === slug);
}

/** Videodateien (von Maryam per KI-Generator erstellt) – liegen in /public/video. */
export const VIDEO = {
  heroLoop: "/video/hero-loop.mp4",
  heroPoster: "/video/hero-poster.jpg",
  turn: (slug: string) => `/video/turn-${slug}.mp4`,
  background: (slug: string) => `/video/bg-${slug}.mp4`,
};
