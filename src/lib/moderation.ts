/**
 * Prüfung von Schülerfragen im Live-Unterricht, bevor sie irgendjemand sieht:
 * 1. schnelle Wortliste (offensichtliche Beleidigungen/Obszönitäten, mehrere Sprachen)
 * 2. Claude: Sprache erkennen, ins Deutsche übersetzen, beurteilen (beleidigend, sexuell, Unsinn/Spam?)
 * Ohne Claude (Testmodus) greift nur die Wortliste, die Frage bleibt unübersetzt.
 */

export interface ModerationResult {
  allowed: boolean;
  /** kurzer deutscher Grund, nur für die Fahrschule sichtbar */
  reason: string;
  /** Sprachcode der Frage, z. B. "tr" */
  lang: string;
  /** Frage auf Deutsch (bei deutscher Frage = Original, Rechtschreibung leicht geglättet) */
  german: string;
}

/** Normalisiert Text gegen einfache Tricks (B-l-ö-d, Ziffern statt Buchstaben). */
export function normalize(text: string): string {
  return text.toLowerCase()
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/[0@]/g, "o").replace(/[1!|]/g, "i").replace(/3/g, "e").replace(/4/g, "a").replace(/[5$]/g, "s").replace(/7/g, "t")
    .replace(/[^\p{L}\s]/gu, "")
    .replace(/(\p{L})\1{2,}/gu, "$1$1");
}

/** Wortstämme (Auszug). Treffer → sofort blockiert. Bewusst kurz: Claude ist die eigentliche Prüfung. */
const BLOCK_STEMS = [
  // deutsch
  "arschloch", "wichser", "hurensohn", "fotze", "schlampe", "missgeburt", "spast", "fick", "nutte", "bastard", "vollidiot", "drecksau", "schwuchtel",
  // englisch
  "fuck", "motherfucker", "bitch", "cunt", "asshole", "dickhead", "retard", "slut", "whore",
  // türkisch
  "orospu", "siktir", "yarrak", "pezevenk", "gavat", "kahpe",
  // arabisch (Umschrift) / russisch (Umschrift) / spanisch / französisch
  "sharmouta", "blyad", "blyat", "pizdec", "puta", "pendejo", "cabron", "gilipollas", "connard", "salope", "encule", "putain",
];
const BLOCK_SCRIPT = ["сука", "блять", "блядь", "хуй", "пизд", "шлюх", "شرموط", "قحبة"];
// Bewusst ohne mehrdeutige Wörter (z. B. türk. „huy“ = Charakter, arab. „qalb“ = Herz) – keine falschen Sperren.

export function quickCheck(text: string): { allowed: boolean; reason: string } {
  const n = normalize(text);
  // zusätzlich jede Buchstaben-Wiederholung auf einen Buchstaben kürzen („FUUUCK“ → „fuck“)
  const variants = [n, n.replace(/(\p{L})\1+/gu, "$1")];
  const hit = BLOCK_STEMS.find((s) => variants.some((v) => v.split(/\s+/).some((w) => w.startsWith(s) || w.startsWith(s.replace(/(\p{L})\1+/gu, "$1")))
    || (s.length >= 6 && v.replace(/\s/g, "").includes(s))));
  if (hit) return { allowed: false, reason: "Beleidigung/Schimpfwort erkannt" };
  if (BLOCK_SCRIPT.some((s) => text.toLowerCase().includes(s))) return { allowed: false, reason: "Beleidigung/Schimpfwort erkannt" };
  if (/https?:\/\/|www\./i.test(text)) return { allowed: false, reason: "Links sind nicht erlaubt" };
  if (/(.)\1{7,}/u.test(text) || text.replace(/\s/g, "").length < 3) return { allowed: false, reason: "Kein sinnvoller Text" };
  return { allowed: true, reason: "" };
}

const SYSTEM = `Du prüfst Fragen von Fahrschülern im Theorieunterricht einer Fahrschule in Deutschland, bevor sie im Unterricht angezeigt werden.
Die Fragen können in jeder Sprache sein (oft Türkisch, Arabisch, Russisch, Englisch, Spanisch, Französisch, Farsi, Deutsch).
Aufgaben:
1. Sprache erkennen (ISO-Code, z. B. "tr").
2. Ins Deutsche übersetzen – einfach, sinngetreu. Ist die Frage schon Deutsch: nur offensichtliche Tippfehler glätten.
3. Entscheiden, ob sie gezeigt werden darf.
NICHT erlaubt: Beleidigungen, Schimpfwörter (auch verschleiert oder in anderer Schrift), sexuelle Inhalte, Diskriminierung, Drohungen,
Belästigung von Personen, Spam, Werbung, absichtlicher Unsinn oder Witze, die den Unterricht stören.
Erlaubt: jede ernst gemeinte Frage oder Bemerkung zum Unterricht, zum Fahren, zur Prüfung oder zur Fahrschule – auch wenn sie
unbeholfen formuliert, kritisch oder umgangssprachlich ist. Im Zweifel bei echter Frage: erlauben.
Antworte ausschließlich mit JSON: {"lang":"..","german":"..","allowed":true|false,"reason":"kurzer deutscher Grund, leer wenn erlaubt"}`;

export interface ClaudeModeratorConfig { apiKey: string; model?: string; fetchImpl?: typeof fetch; timeoutMs?: number }

export async function moderateQuestion(text: string, cfg?: ClaudeModeratorConfig): Promise<ModerationResult> {
  const clean = text.trim().slice(0, 300);
  const quick = quickCheck(clean);
  if (!quick.allowed) return { allowed: false, reason: quick.reason, lang: "?", german: clean };
  if (!cfg?.apiKey) return { allowed: true, reason: "", lang: "?", german: clean };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), cfg.timeoutMs ?? 8000);
  try {
    const res = await (cfg.fetchImpl ?? fetch)("https://api.anthropic.com/v1/messages", {
      method: "POST", signal: ctrl.signal,
      headers: { "content-type": "application/json", "x-api-key": cfg.apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: cfg.model || "claude-haiku-5-5", max_tokens: 400, system: SYSTEM,
        messages: [{ role: "user", content: `Frage des Schülers:\n"""${clean}"""` }],
      }),
    });
    if (!res.ok) throw new Error(`Claude ${res.status}`);
    const json = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
    const out = json.content?.find((c) => c.type === "text")?.text ?? "";
    const m = /\{[\s\S]*\}/.exec(out);
    const parsed = m ? (JSON.parse(m[0]) as Partial<ModerationResult>) : null;
    if (!parsed || typeof parsed.allowed !== "boolean") throw new Error("Antwort nicht lesbar");
    const german = String(parsed.german || clean).slice(0, 400);
    // Auch die Übersetzung noch einmal gegen die Wortliste prüfen.
    const again = quickCheck(german);
    return {
      allowed: parsed.allowed && again.allowed,
      reason: !parsed.allowed ? String(parsed.reason || "Nicht passend für den Unterricht").slice(0, 120) : again.reason,
      lang: String(parsed.lang || "?").slice(0, 5),
      german,
    };
  } catch (e) {
    // Prüfung nicht möglich → lieber zurückhalten: nur die Fahrschule sieht die Frage und entscheidet.
    console.error("[moderation]", (e as Error).message);
    return { allowed: false, reason: "Automatische Prüfung nicht möglich – bitte selbst ansehen", lang: "?", german: clean };
  } finally {
    clearTimeout(timer);
  }
}

/** „Lona Scholz“ → „Lona S.“ */
export function shortName(full: string): string {
  const parts = full.trim().split(/\s+/);
  if (parts.length < 2) return parts[0] ?? "";
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}
