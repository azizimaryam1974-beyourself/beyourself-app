import type { TargetLanguageCode } from "../languages";
import type { TranslationProvider, Translations } from "./types";

/**
 * Testdienst ohne Azure-Konto: markiert den Text nur mit dem Sprachcode.
 * Wird automatisch genutzt, solange keine Azure-Schlüssel hinterlegt sind.
 */
export class MockTranslator implements TranslationProvider {
  readonly name = "mock";
  calls: { text: string; targets: TargetLanguageCode[] }[] = [];

  async translate(text: string, targets: TargetLanguageCode[]): Promise<Translations> {
    this.calls.push({ text, targets: [...targets] });
    const out: Translations = {};
    for (const t of new Set(targets)) out[t] = `[${t.toUpperCase()}] ${text}`;
    return out;
  }
}
