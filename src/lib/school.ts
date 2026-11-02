/**
 * Stammdaten der Fahrschule – EINE Stelle für Webseite, Impressum, Google-Daten (Schema.org) und App.
 * Fehlt etwas (z. B. Telefon), wird es auf der Webseite einfach weggelassen.
 * Später, mit mehreren Fahrschulen, kommt das pro Fahrschule aus der Datenbank.
 */
export const SCHOOL = {
  name: "Fahrschule beyourself",
  shortName: "beyourself",
  url: (process.env.APP_URL || "https://fahrschule-beyourself.de").replace(/\/$/, ""),
  email: "info@fahrschule-beyourself.de",
  phone: process.env.SCHOOL_PHONE || "", // z. B. "+49 561 1234567"
  owner: process.env.SCHOOL_OWNER || "",  // Inhaberin (für das Impressum)
  street: "Rudolf-Schwander-Straße 9",
  zip: "34117",
  city: "Kassel",
  region: "Hessen",
  country: "DE",
  geo: { lat: 51.3127, lon: 9.4797 },
  /** Bürozeiten, z. B. [{ days: ["Mo","Di"], from: "15:00", to: "18:00" }] – leer = nicht anzeigen */
  hours: [] as Array<{ days: string[]; from: string; to: string }>,
  /** Profile, die zur Fahrschule gehören (Google, Instagram …) – helfen Google und KI-Suchen, uns sicher zuzuordnen */
  sameAs: [] as string[],
  areaServed: ["Kassel", "Vellmar", "Baunatal", "Kaufungen", "Lohfelden", "Fuldatal", "Niestetal", "Ahnatal", "Calden", "Schauenburg"],
  slogan: "Fahre deinen eigenen Weg.",
  description: "Fahrschule in Kassel für Klasse B, B197 (Automatik mit Schaltberechtigung), B78 (Automatik) und die Umschreibung ausländischer Führerscheine. Geduldige Ausbildung, Online-Buchung der Fahrstunden und Theorieunterricht live übersetzt in deine Sprache.",
} as const;

export const fullAddress = `${SCHOOL.street}, ${SCHOOL.zip} ${SCHOOL.city}`;
