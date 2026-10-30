import { isBookableLanguage, type TargetLanguageCode } from "./languages";

/**
 * Sprachpaket: einmalig 30 € brutto pro Ausbildung.
 * Beträge immer in Cent (keine Gleitkommazahlen für Geld).
 */
export const LANGUAGE_PACKAGE_PRICE_CENTS = 3000;
export const LANGUAGE_PACKAGE_CURRENCY = "EUR";

export type LanguagePackageStatus = "booked" | "paid" | "cancelled";

export interface LanguagePackage {
  id: string;
  userId: string;
  schoolId: string;
  language: TargetLanguageCode;
  priceCents: number;
  status: LanguagePackageStatus;
  bookedAt: string;
}

export interface SignupLanguageChoice {
  wantsPackage: boolean;
  language?: string | null;
}

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: string };

/**
 * Prüft die Auswahl bei der Anmeldung.
 * - Ohne Paket: keine Sprache nötig.
 * - Mit Paket: genau eine buchbare Sprache.
 */
export function validateSignupChoice(
  choice: SignupLanguageChoice,
): ValidationResult<{ language: TargetLanguageCode } | null> {
  if (!choice.wantsPackage) return { ok: true, value: null };
  if (!choice.language) {
    return { ok: false, error: "Bitte wähle die Sprache für dein Sprachpaket." };
  }
  if (!isBookableLanguage(choice.language)) {
    return { ok: false, error: "Diese Sprache ist nicht buchbar." };
  }
  return { ok: true, value: { language: choice.language } };
}

/**
 * Hat die Person Zugriff auf die Live-Übersetzung?
 *
 * Entscheidung: Die Funktion ist sichtbar, sobald das Paket gebucht ist
 * ("booked" oder "paid"). Stornierte Pakete schalten sie ab.
 * Soll später erst nach Zahlung freigeschaltet werden, nur hier ändern.
 */
export function hasTranslationAccess(pkg: Pick<LanguagePackage, "status"> | null | undefined): boolean {
  if (!pkg) return false;
  return pkg.status === "booked" || pkg.status === "paid";
}

export function formatPrice(cents: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: LANGUAGE_PACKAGE_CURRENCY }).format(cents / 100);
}
