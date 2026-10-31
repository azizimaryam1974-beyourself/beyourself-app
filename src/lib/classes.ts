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
    name: "Pkw mit Schaltwagen",
    sign: "Klasse B",
    turn: "left",
    short: "Der klassische Führerschein: Ausbildung und Prüfung auf dem Schaltwagen – danach darfst du jedes Auto bis 3,5 t fahren.",
    long: [
      "Mit Klasse B fährst du Pkw bis 3,5 t mit bis zu 8 Mitfahrenden – Schaltwagen und Automatik.",
      "Du lernst Theorie und Praxis bei uns in Ruhe und in deinem Tempo – mit Übungsfahrten, Sonderfahrten über Land, Autobahn und bei Nacht und einer Prüfungsvorbereitung, die Sicherheit gibt.",
    ],
  },
  {
    slug: "b197",
    k: "B197",
    name: "Automatik mit Schaltberechtigung",
    sign: "Klasse B197",
    turn: "right",
    short: "Ausbildung und Prüfung auf Automatik – und trotzdem darfst du später auch Schaltwagen fahren.",
    long: [
      "Du lernst entspannt auf dem Automatik-Auto und machst die Prüfung auch dort. Nach mindestens 10 Fahrstunden auf dem Schaltwagen und einer kurzen Testfahrt darfst du trotzdem Schaltwagen fahren.",
      "Ideal, wenn du dich voll auf den Verkehr konzentrieren möchtest statt auf Kupplung und Gang.",
    ],
  },
  {
    slug: "b78",
    k: "B78",
    name: "Nur Automatik",
    sign: "Klasse B78",
    turn: "straight",
    short: "Ausbildung und Prüfung komplett auf Automatik – der direkteste Weg zum Führerschein.",
    long: [
      "Du lernst und fährst die Prüfung ausschließlich auf dem Automatik-Auto. In deinem Führerschein steht danach die Schlüsselzahl 78: Du darfst Automatik-Fahrzeuge fahren, aber keinen Schaltwagen.",
      "Perfekt, wenn du sicher bist, dass du nur Automatik fahren möchtest – keine Kupplung, kein Schalten, volle Konzentration auf den Verkehr.",
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
