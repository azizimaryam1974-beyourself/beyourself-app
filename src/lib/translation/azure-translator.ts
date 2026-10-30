import { getLanguage, SOURCE_LANGUAGE, type TargetLanguageCode } from "../languages";
import { applyGlossary, DEFAULT_GLOSSARY, type GlossaryTerm } from "../glossary";
import type { TranslationProvider, Translations } from "./types";

export interface AzureTranslatorConfig {
  key: string;
  region: string;
  /** EU-Endpunkt hält die Verarbeitung in Europa. */
  endpoint?: string;
  glossary?: GlossaryTerm[];
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export const AZURE_TRANSLATOR_EU_ENDPOINT = "https://api-eur.cognitive.microsofttranslator.com";

interface AzureTranslateResponseItem {
  translations: { text: string; to: string }[];
}

export class AzureTranslator implements TranslationProvider {
  readonly name = "azure";
  private readonly endpoint: string;
  private readonly glossary: GlossaryTerm[];
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(private readonly config: AzureTranslatorConfig) {
    if (!config.key) throw new Error("AZURE_TRANSLATOR_KEY fehlt");
    if (!config.region) throw new Error("AZURE_TRANSLATOR_REGION fehlt");
    this.endpoint = (config.endpoint || AZURE_TRANSLATOR_EU_ENDPOINT).replace(/\/$/, "");
    this.glossary = config.glossary ?? DEFAULT_GLOSSARY;
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.timeoutMs = config.timeoutMs ?? 8000;
  }

  async translate(text: string, targets: TargetLanguageCode[]): Promise<Translations> {
    const unique = [...new Set(targets)];
    if (!text.trim() || unique.length === 0) return {};

    // Sprachen mit Fachbegriff-Treffer brauchen eine eigene Anfrage, weil das
    // dynamische Wörterbuch je Zielsprache eine andere Übersetzung erzwingt.
    const shared: TargetLanguageCode[] = [];
    const individual: { lang: TargetLanguageCode; text: string }[] = [];
    for (const lang of unique) {
      const g = applyGlossary(text, lang, this.glossary);
      if (g.changed) individual.push({ lang, text: g.text });
      else shared.push(lang);
    }

    const requests: Promise<Translations>[] = [];
    if (shared.length) requests.push(this.request(text, shared));
    for (const item of individual) requests.push(this.request(item.text, [item.lang]));

    const results = await Promise.all(requests);
    return Object.assign({}, ...results);
  }

  private async request(text: string, targets: TargetLanguageCode[]): Promise<Translations> {
    const params = new URLSearchParams({ "api-version": "3.0", from: SOURCE_LANGUAGE.translatorCode });
    for (const t of targets) params.append("to", getLanguage(t)!.translatorCode);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await this.fetchImpl(`${this.endpoint}/translate?${params}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Ocp-Apim-Subscription-Key": this.config.key,
          "Ocp-Apim-Subscription-Region": this.config.region,
        },
        body: JSON.stringify([{ Text: text }]),
        signal: controller.signal,
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Azure Translator ${res.status}: ${body.slice(0, 200)}`);
      }
      const data = (await res.json()) as AzureTranslateResponseItem[];
      const out: Translations = {};
      for (const tr of data[0]?.translations ?? []) {
        const lang = targets.find((t) => getLanguage(t)!.translatorCode === tr.to);
        if (lang) out[lang] = tr.text;
      }
      return out;
    } finally {
      clearTimeout(timer);
    }
  }
}
