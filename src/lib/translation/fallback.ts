import type { TargetLanguageCode } from "../languages";
import type { TranslateOptions, TranslationProvider, Translations } from "./types";

/**
 * Erst den Hauptdienst fragen (z. B. Claude). Fällt er aus oder fehlen
 * Sprachen, übersetzt der Ersatzdienst (z. B. Azure) den Rest.
 * So bleibt der Unterricht auch bei einer Störung übersetzt.
 */
export class FallbackTranslator implements TranslationProvider {
  readonly name: string;
  constructor(
    private readonly primary: TranslationProvider,
    private readonly secondary: TranslationProvider,
  ) {
    this.name = `${primary.name}+${secondary.name}`;
  }

  async translate(text: string, targets: TargetLanguageCode[], options?: TranslateOptions): Promise<Translations> {
    let out: Translations = {};
    try {
      out = await this.primary.translate(text, targets, options);
    } catch (e) {
      console.warn(`[translate] ${this.primary.name} fehlgeschlagen, nutze ${this.secondary.name}:`, e instanceof Error ? e.message : e);
    }
    const missing = targets.filter((t) => !out[t]);
    if (missing.length) Object.assign(out, await this.secondary.translate(text, missing, options));
    return out;
  }
}
