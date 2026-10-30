/**
 * Sprachen für die Live-Übersetzung im Theorieunterricht.
 *
 * Unterrichtssprache ist immer Deutsch. Die Zielsprachen sind bewusst auf die
 * von Maryam gewählten Sprachen begrenzt; Farsi ist vorbereitet, aber
 * standardmäßig ausgeschaltet (Schalter `enabled`).
 */

export const SOURCE_LANGUAGE = {
  /** Erkennungssprache für Azure Speech-to-Text */
  speechLocale: "de-DE",
  /** Sprachcode für Azure Translator */
  translatorCode: "de",
} as const;

export type TargetLanguageCode = "tr" | "en" | "ru" | "ar" | "es" | "fa";

export interface TargetLanguage {
  code: TargetLanguageCode;
  /** Bezeichnung auf Deutsch (für Verwaltung und Anmeldung) */
  labelDe: string;
  /** Bezeichnung in der Sprache selbst (für Schüler) */
  nativeLabel: string;
  /** Azure-Translator-Code */
  translatorCode: string;
  /** Azure Neural Voice für die Vorlese-Stimme */
  ttsVoice: string;
  /** Schreibrichtung rechts nach links */
  rtl: boolean;
  /** Im Angebot sichtbar? */
  enabled: boolean;
}

export const TARGET_LANGUAGES: readonly TargetLanguage[] = [
  { code: "tr", labelDe: "Türkisch", nativeLabel: "Türkçe", translatorCode: "tr", ttsVoice: "tr-TR-EmelNeural", rtl: false, enabled: true },
  { code: "en", labelDe: "Englisch", nativeLabel: "English", translatorCode: "en", ttsVoice: "en-GB-SoniaNeural", rtl: false, enabled: true },
  { code: "ru", labelDe: "Russisch", nativeLabel: "Русский", translatorCode: "ru", ttsVoice: "ru-RU-SvetlanaNeural", rtl: false, enabled: true },
  { code: "ar", labelDe: "Arabisch", nativeLabel: "العربية", translatorCode: "ar", ttsVoice: "ar-SA-ZariyahNeural", rtl: true, enabled: true },
  { code: "es", labelDe: "Spanisch", nativeLabel: "Español", translatorCode: "es", ttsVoice: "es-ES-ElviraNeural", rtl: false, enabled: true },
  { code: "fa", labelDe: "Farsi", nativeLabel: "فارسی", translatorCode: "fa", ttsVoice: "fa-IR-DilaraNeural", rtl: true, enabled: false },
] as const;

export function getLanguage(code: string): TargetLanguage | undefined {
  return TARGET_LANGUAGES.find((l) => l.code === code);
}

/**
 * Farsi lässt sich ohne Codeänderung zuschalten: ENABLE_FARSI=1 in der .env.
 * (Nur serverseitig ausgewertet; der Browser bekommt die fertige Liste.)
 */
function isEnabled(l: TargetLanguage): boolean {
  if (l.code === "fa" && typeof process !== "undefined" && process.env?.ENABLE_FARSI === "1") return true;
  return l.enabled;
}

/** Sprachen, die aktuell buchbar sind. */
export function bookableLanguages(): TargetLanguage[] {
  return TARGET_LANGUAGES.filter(isEnabled);
}

export function isBookableLanguage(code: unknown): code is TargetLanguageCode {
  return typeof code === "string" && bookableLanguages().some((l) => l.code === code);
}
