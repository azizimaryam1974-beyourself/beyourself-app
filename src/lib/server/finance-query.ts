import { addDays, berlinToMs, dayKey } from "../time";
import { MONEY_CATEGORY_LABEL, type MoneyCategory, type MoneyFilter } from "./finance";

/** Filter aus der Adresszeile lesen (gleich für Seite und Export). */
export interface FinanceParams { art?: string; zeit?: string; von?: string; bis?: string; bereich?: string; zahlart?: string; schueler?: string; q?: string }

export function parseFinance(p: FinanceParams, now = Date.now()): { filter: MoneyFilter; zeit: string; label: string } {
  const today = dayKey(now);
  const [y, m] = today.split("-").map(Number);
  const ym = (yy: number, mm: number) => `${yy}-${String(mm).padStart(2, "0")}-01`;
  const zeit = p.zeit || (p.art === "offen" ? "alle" : "monat");
  let from: number | undefined, to: number | undefined, label = "";
  if (zeit === "monat") { from = berlinToMs(ym(y, m), "00:00"); label = new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric" }).format(now); }
  else if (zeit === "vormonat") {
    const [py, pm] = m === 1 ? [y - 1, 12] : [y, m - 1];
    from = berlinToMs(ym(py, pm), "00:00"); to = berlinToMs(ym(y, m), "00:00");
    label = new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric", timeZone: "UTC" }).format(Date.UTC(py, pm - 1, 15));
  } else if (zeit === "jahr") { from = berlinToMs(`${y}-01-01`, "00:00"); label = `Jahr ${y}`; }
  else if (zeit === "eigen") {
    const ok = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
    if (ok(p.von)) from = berlinToMs(p.von!, "00:00");
    if (ok(p.bis)) to = berlinToMs(addDays(p.bis!, 1), "00:00");
    label = `${p.von ? p.von.split("-").reverse().join(".") : "Anfang"} – ${p.bis ? p.bis.split("-").reverse().join(".") : "heute"}`;
  } else label = "gesamter Zeitraum";
  const art = p.art === "offen" || p.art === "alle" ? p.art : "einnahme";
  const bereich = (p.bereich && p.bereich in MONEY_CATEGORY_LABEL ? p.bereich : "") as MoneyCategory | "";
  return { filter: { kind: art, from, to, category: bereich, provider: p.zahlart || "", userId: p.schueler || "", q: p.q }, zeit, label };
}
