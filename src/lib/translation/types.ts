import type { TargetLanguageCode } from "../languages";

export type Translations = Partial<Record<TargetLanguageCode, string>>;

/**
 * Austauschbarer Übersetzungsdienst. Implementiert: Azure, Claude,
 * Mock und Fallback (Hauptdienst + Ersatz). Ein weiterer Dienst bedeutet nur eine neue Implementierung
 * dieses Interfaces.
 */
export interface TranslateOptions {
  /** Vorherige deutsche Sätze der Stunde (für Zusammenhang). */
  context?: string[];
}

export interface TranslationProvider {
  readonly name: string;
  translate(text: string, targets: TargetLanguageCode[], options?: TranslateOptions): Promise<Translations>;
}
