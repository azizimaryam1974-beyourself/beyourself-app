import type { TargetLanguageCode } from "./languages";

/**
 * Fachbegriffe aus dem Theorieunterricht.
 *
 * 1. `de` wird an die Spracherkennung übergeben (Azure Phrase List), damit
 *    diese Wörter zuverlässig erkannt werden.
 * 2. Ist für eine Zielsprache eine feste Übersetzung hinterlegt, wird sie
 *    über das "dynamische Wörterbuch" von Azure Translator erzwungen.
 *
 * WICHTIG: Feste Übersetzungen nur von Muttersprachlern/geprüften Quellen
 * eintragen. Leere Felder = Azure übersetzt selbst.
 */
export interface GlossaryTerm {
  de: string;
  translations: Partial<Record<TargetLanguageCode, string>>;
}

export const DEFAULT_GLOSSARY: GlossaryTerm[] = [
  { de: "rechts vor links", translations: { en: "right before left" } },
  { de: "Vorfahrt gewähren", translations: { en: "give way" } },
  { de: "Vorfahrtstraße", translations: { en: "priority road" } },
  { de: "Fahrstreifen", translations: { en: "lane" } },
  { de: "Fußgängerüberweg", translations: { en: "pedestrian crossing" } },
  { de: "Zebrastreifen", translations: { en: "zebra crossing" } },
  { de: "Lichtzeichenanlage", translations: { en: "traffic lights" } },
  { de: "Haltelinie", translations: { en: "stop line" } },
  { de: "Sicherheitsabstand", translations: { en: "safe following distance" } },
  { de: "Anhalteweg", translations: { en: "stopping distance" } },
  { de: "Bremsweg", translations: { en: "braking distance" } },
  { de: "Reaktionsweg", translations: { en: "reaction distance" } },
  { de: "Schulterblick", translations: { en: "shoulder check" } },
  { de: "Probezeit", translations: { en: "probationary period" } },
  { de: "Punkte in Flensburg", translations: { en: "penalty points (Flensburg register)" } },
  { de: "Verkehrszeichen", translations: {} },
  { de: "Zusatzzeichen", translations: { en: "additional sign" } },
  { de: "Gefahrzeichen", translations: { en: "warning sign" } },
  { de: "Vorschriftzeichen", translations: { en: "regulatory sign" } },
  { de: "Richtzeichen", translations: { en: "informational sign" } },
  { de: "Kreisverkehr", translations: { en: "roundabout" } },
  { de: "Autobahn", translations: {} },
  { de: "Kraftfahrstraße", translations: { en: "motorway-style road" } },
  { de: "Rettungsgasse", translations: { en: "emergency corridor" } },
  { de: "Reißverschlussverfahren", translations: { en: "zipper merge" } },
  { de: "Überholverbot", translations: { en: "no overtaking" } },
  { de: "Halteverbot", translations: { en: "no stopping" } },
  { de: "Parkverbot", translations: { en: "no parking" } },
  { de: "Promillegrenze", translations: { en: "blood alcohol limit" } },
  { de: "Fahrerlaubnis", translations: { en: "driving licence" } },
  { de: "Führerschein", translations: {} },
  { de: "Umschreibung", translations: { en: "conversion of a foreign licence" } },
  { de: "Theorieprüfung", translations: { en: "theory test" } },
  { de: "Fehlerpunkte", translations: { en: "error points" } },
  { de: "Bahnübergang", translations: { en: "level crossing" } },
  { de: "Andreaskreuz", translations: { en: "St Andrew's cross (railway crossing sign)" } },
  { de: "verkehrsberuhigter Bereich", translations: { en: "traffic-calmed area" } },
  { de: "Tempo-30-Zone", translations: { en: "30 km/h zone" } },
  { de: "Abblendlicht", translations: { en: "dipped headlights" } },
  { de: "Fernlicht", translations: { en: "full beam" } },
  { de: "Warnblinklicht", translations: { en: "hazard lights" } },
  { de: "Warndreieck", translations: { en: "warning triangle" } },
];

/** Deutsche Begriffe für die Phrase List der Spracherkennung. */
export function recognitionPhrases(glossary: GlossaryTerm[] = DEFAULT_GLOSSARY): string[] {
  return [...new Set(glossary.map((t) => t.de))];
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Der Text wird als Plain Text übersetzt; Azure wertet dort nur das
 * mstrans-Markup aus. Spitze Klammern und Anführungszeichen entfernen wir
 * aus Begriffen/Übersetzungen, damit das Markup nicht zerbricht.
 */
function safeAttr(s: string): string {
  return s.replace(/["<>]/g, "");
}

function escapeText(s: string): string {
  return s;
}

/**
 * Markiert gefundene Fachbegriffe für eine Zielsprache mit dem dynamischen
 * Wörterbuch von Azure Translator:
 *   <mstrans:dictionary translation="give way">Vorfahrt gewähren</mstrans:dictionary>
 *
 * Längere Begriffe zuerst, damit "Vorfahrt gewähren" vor "Vorfahrt" greift.
 * Gibt `changed=false` zurück, wenn kein Begriff vorkommt; dann kann der
 * Text gemeinsam für mehrere Sprachen übersetzt werden.
 */
export function applyGlossary(
  text: string,
  target: TargetLanguageCode,
  glossary: GlossaryTerm[] = DEFAULT_GLOSSARY,
): { text: string; changed: boolean } {
  const terms = glossary
    .filter((t) => t.translations[target])
    .sort((a, b) => b.de.length - a.de.length);
  if (terms.length === 0) return { text, changed: false };

  const pattern = new RegExp(
    `(?<![\\p{L}\\p{N}])(${terms.map((t) => escapeRegExp(t.de)).join("|")})(?![\\p{L}\\p{N}])`,
    "giu",
  );
  let changed = false;
  let out = "";
  let last = 0;
  for (const m of text.matchAll(pattern)) {
    const term = terms.find((t) => t.de.toLowerCase() === m[0].toLowerCase());
    if (!term) continue;
    changed = true;
    out += escapeText(text.slice(last, m.index));
    out += `<mstrans:dictionary translation="${safeAttr(term.translations[target]!)}">${escapeText(m[0])}</mstrans:dictionary>`;
    last = m.index! + m[0].length;
  }
  if (!changed) return { text, changed: false };
  out += escapeText(text.slice(last));
  return { text: out, changed: true };
}
