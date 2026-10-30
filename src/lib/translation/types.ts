import type { TargetLanguageCode } from "../languages";

export type Translations = Partial<Record<TargetLanguageCode, string>>;

/**
 * Austauschbarer Übersetzungsdienst. Azure ist Standard; ein Wechsel
 * (z. B. zu Google oder Soniox) bedeutet nur eine neue Implementierung
 * dieses Interfaces.
 */
export interface TranslationProvider {
  readonly name: string;
  translate(text: string, targets: TargetLanguageCode[]): Promise<Translations>;
}
