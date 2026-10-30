import { getLanguage, type TargetLanguageCode } from "../languages";
import { DEFAULT_GLOSSARY, type GlossaryTerm } from "../glossary";
import type { TranslateOptions, TranslationProvider, Translations } from "./types";

/**
 * Übersetzung mit Claude (Anthropic API).
 *
 * Vorteil gegenüber reiner Maschinenübersetzung: versteht den Zusammenhang
 * der Theoriestunde (vorherige Sätze), setzt Fachbegriffe grammatisch
 * richtig ein und übersetzt alle Sprachen in EINER Anfrage.
 */
export interface ClaudeTranslatorConfig {
  apiKey: string;
  model?: string;
  glossary?: GlossaryTerm[];
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  endpoint?: string;
}

export const DEFAULT_CLAUDE_MODEL = "claude-haiku-5-5";

const SYSTEM_PROMPT = `Du übersetzt live den Theorieunterricht einer deutschen Fahrschule für Fahrschüler, die wenig Deutsch sprechen.
Regeln:
- Übersetze NUR den neuen Satz, den Kontext nur zum Verstehen nutzen.
- Bedeutung vor Wortlaut. Verkehrsregeln müssen inhaltlich exakt stimmen.
- Einfache, klare Alltagssprache. Keine Erklärungen, keine Zusätze.
- Vorgegebene Fachbegriffe verwenden (Grammatik anpassen ist erlaubt).
- Erkennungsfehler der Spracherkennung sinnvoll korrigieren.
- Antworte ausschließlich mit einem JSON-Objekt: {"<sprachcode>": "<übersetzung>", ...}`;

interface MessagesResponse {
  content?: { type: string; text?: string }[];
}

export class ClaudeTranslator implements TranslationProvider {
  readonly name = "claude";
  private readonly model: string;
  private readonly glossary: GlossaryTerm[];
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly endpoint: string;

  constructor(private readonly config: ClaudeTranslatorConfig) {
    if (!config.apiKey) throw new Error("ANTHROPIC_API_KEY fehlt");
    this.model = config.model || DEFAULT_CLAUDE_MODEL;
    this.glossary = config.glossary ?? DEFAULT_GLOSSARY;
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.timeoutMs = config.timeoutMs ?? 10_000;
    this.endpoint = config.endpoint ?? "https://api.anthropic.com/v1/messages";
  }

  /** Nur Begriffe, die im Satz vorkommen – hält die Anfrage klein. */
  relevantTerms(text: string, targets: TargetLanguageCode[]): string[] {
    const lower = text.toLowerCase();
    return this.glossary
      .filter((t) => lower.includes(t.de.toLowerCase()))
      .map((t) => {
        const parts = targets.map((l) => (t.translations[l] ? `${l}: ${t.translations[l]}` : null)).filter(Boolean);
        return parts.length ? `- "${t.de}" → ${parts.join(" | ")}` : null;
      })
      .filter((x): x is string => x !== null);
  }

  buildUserMessage(text: string, targets: TargetLanguageCode[], context: string[] = []): string {
    const langs = targets.map((l) => `${l} (${getLanguage(l)!.labelDe})`).join(", ");
    const terms = this.relevantTerms(text, targets);
    return [
      context.length ? `Kontext (bereits übersetzt):\n${context.map((c) => `- ${c}`).join("\n")}` : null,
      terms.length ? `Fachbegriffe:\n${terms.join("\n")}` : null,
      `Zielsprachen: ${langs}`,
      `Neuer Satz:\n${text}`,
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  async translate(text: string, targets: TargetLanguageCode[], options: TranslateOptions = {}): Promise<Translations> {
    const unique = [...new Set(targets)];
    if (!text.trim() || unique.length === 0) return {};

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await this.fetchImpl(this.endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": this.config.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 1024,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: this.buildUserMessage(text, unique, options.context?.slice(-3)) }],
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Claude ${res.status}: ${body.slice(0, 200)}`);
      }
      const data = (await res.json()) as MessagesResponse;
      const raw = (data.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("");
      return parseTranslations(raw, unique);
    } finally {
      clearTimeout(timer);
    }
  }
}

/** Holt das JSON-Objekt aus der Antwort, auch wenn es in ```json steckt. */
export function parseTranslations(raw: string, targets: TargetLanguageCode[]): Translations {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Claude: keine JSON-Antwort");
  const obj = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
  const out: Translations = {};
  for (const l of targets) {
    const v = obj[l];
    if (typeof v === "string" && v.trim()) out[l] = v.trim();
  }
  return out;
}
