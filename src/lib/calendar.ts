/**
 * Kalender-Regeln der Fahrschule (reine Logik, testbar):
 * - Arbeitsrahmen: Okt–Apr 9–21 Uhr, Mai–Sep 9–23 Uhr
 * - keine Sonntage, keine gesetzlichen Feiertage in Hessen
 * - Beleuchtungsfahrten erst nach Sonnenuntergang in Kassel
 * - freie Startzeiten im 15-Minuten-Raster, ohne unbrauchbare Lücken (< 60 Min)
 */
import { addDays, berlinToMs, weekdayOf } from "./time";

export const SCHOOL_LAT = 51.3127; // 34117 Kassel, Rudolf-Schwander-Str. 9
export const SCHOOL_LON = 9.4797;
export const STEP_MIN = 15;
/** Kürzeste buchbare Fahrt – kleinere Lücken sind für niemanden mehr nutzbar. */
export const MIN_GAP = 60;

export interface Interval { start: number; end: number }

// ---------- Arbeitsrahmen -----------------------------------------------------

/** Rahmen eines Tages in Minuten ab Mitternacht (deutsche Zeit). */
export function frameFor(day: string): { from: number; to: number } {
  const month = Number(day.slice(5, 7));
  const winter = month >= 10 || month <= 4; // Okt, Nov, Dez, Jan, Feb, Mär, Apr
  return { from: 9 * 60, to: (winter ? 21 : 23) * 60 };
}

// ---------- Feiertage Hessen ---------------------------------------------------

/** Ostersonntag (gregorianisch, Algorithmus nach Gauß/Meeus). */
export function easter(year: number): string {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Gesetzliche Feiertage in Hessen für ein Jahr: Schlüssel "YYYY-MM-DD" → Name. */
export function hessenHolidays(year: number): Map<string, string> {
  const e = easter(year);
  return new Map([
    [`${year}-01-01`, "Neujahr"],
    [addDays(e, -2), "Karfreitag"],
    [addDays(e, 1), "Ostermontag"],
    [`${year}-05-01`, "Tag der Arbeit"],
    [addDays(e, 39), "Christi Himmelfahrt"],
    [addDays(e, 50), "Pfingstmontag"],
    [addDays(e, 60), "Fronleichnam"],
    [`${year}-10-03`, "Tag der Deutschen Einheit"],
    [`${year}-12-25`, "1. Weihnachtstag"],
    [`${year}-12-26`, "2. Weihnachtstag"],
  ]);
}

/** Warum an diesem Tag nicht gefahren wird (Sonntag/Feiertag) – sonst null. */
export function closedReason(day: string): string | null {
  if (weekdayOf(day) === 6) return "Sonntag";
  return hessenHolidays(Number(day.slice(0, 4))).get(day) ?? null;
}

// ---------- Sonnenuntergang (Sonnenaufgangs-Gleichung, Genauigkeit ~1–2 Min) ------

const rad = Math.PI / 180;

/** Sonnenuntergang (h0 = −0,833°) bzw. Ende der bürgerlichen Dämmerung (h0 = −6°) als Zeitpunkt (ms). */
export function sunsetMs(day: string, h0 = -0.833, lat = SCHOOL_LAT, lon = SCHOOL_LON): number {
  const [y, m, d] = day.split("-").map(Number);
  const jd = Date.UTC(y, m - 1, d) / 86_400_000 + 2440587.5;
  const n = Math.ceil(jd - 2451545.0 + 0.0008);
  const jStar = n - lon / 360;
  const M = (357.5291 + 0.98560028 * jStar) % 360;
  const C = 1.9148 * Math.sin(M * rad) + 0.02 * Math.sin(2 * M * rad) + 0.0003 * Math.sin(3 * M * rad);
  const lambda = (M + C + 180 + 102.9372) % 360;
  const jTransit = 2451545.0 + jStar + 0.0053 * Math.sin(M * rad) - 0.0069 * Math.sin(2 * lambda * rad);
  const sinDecl = Math.sin(lambda * rad) * Math.sin(23.4397 * rad);
  const cosDecl = Math.cos(Math.asin(sinDecl));
  const cosW = (Math.sin(h0 * rad) - Math.sin(lat * rad) * sinDecl) / (Math.cos(lat * rad) * cosDecl);
  const w = Math.acos(Math.min(1, Math.max(-1, cosW))) / rad;
  return Math.round((jTransit + w / 360 - 2440587.5) * 86_400_000);
}

/** Frühester Start einer Beleuchtungsfahrt: Sonnenuntergang + Puffer, auf 15 Min aufgerundet. */
export function darkStart(day: string, offsetMin = 15): number {
  const t = sunsetMs(day) + offsetMin * 60_000;
  const q = STEP_MIN * 60_000;
  return Math.ceil(t / q) * q;
}

// ---------- Freie Zeiten ---------------------------------------------------------

export interface DayRange { from: number; to: number } // Minuten ab Mitternacht

/** Arbeitszeiten eines Tages (Vorlage ∩ Rahmen) als Zeitpunkte. */
export function workIntervals(day: string, ranges: DayRange[]): Interval[] {
  if (closedReason(day)) return [];
  const f = frameFor(day);
  const toMs = (min: number) => berlinToMs(day, `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`);
  return ranges
    .map((r) => ({ from: Math.max(r.from, f.from), to: Math.min(r.to, f.to) }))
    .filter((r) => r.to > r.from)
    .sort((a, b) => a.from - b.from)
    .map((r) => ({ start: toMs(r.from), end: toMs(r.to) }));
}

/** Intervalle minus belegte Zeiten. */
export function subtract(free: Interval[], busy: Interval[]): Interval[] {
  let out = free.map((i) => ({ ...i }));
  for (const b of busy) {
    const next: Interval[] = [];
    for (const f of out) {
      if (b.end <= f.start || b.start >= f.end) { next.push(f); continue; }
      if (b.start > f.start) next.push({ start: f.start, end: b.start });
      if (b.end < f.end) next.push({ start: b.end, end: f.end });
    }
    out = next;
  }
  return out.filter((i) => i.end > i.start);
}

/**
 * Mögliche Startzeiten für eine Fahrt der Länge `minutes`.
 * Bevorzugt: vor und nach der Fahrt bleibt keine Lücke oder eine von mind. 60 Min – so entstehen
 * keine Reststücke, die niemand mehr buchen kann. Passt in eine freie Zeit so keine Fahrt
 * (z. B. 105 Min frei, 60 Min gewünscht), sind Zeiten direkt am Anfang oder Ende erlaubt.
 */
export function startTimes(free: Interval[], minutes: number, opts: { notBefore?: number; strictGaps?: boolean } = {}): number[] {
  const len = minutes * 60_000, step = STEP_MIN * 60_000, gap = MIN_GAP * 60_000;
  const strict = opts.strictGaps ?? true;
  const out: number[] = [];
  for (const f of free) {
    const start = opts.notBefore !== undefined ? Math.max(f.start, Math.ceil(opts.notBefore / step) * step) : f.start;
    const all: number[] = [];
    for (let s = start; s + len <= f.end; s += step) all.push(s);
    if (!strict) { out.push(...all); continue; }
    const clean = all.filter((s) => {
      const left = s - f.start, right = f.end - (s + len);
      return (left === 0 || left >= gap) && (right === 0 || right >= gap);
    });
    if (clean.length) out.push(...clean);
    else out.push(...all.filter((s) => s === start || s + len === f.end));
  }
  return [...new Set(out)].sort((a, b) => a - b);
}

/** Montag … Samstag einer Woche (Sonntag wird nie gefahren). */
export function workDaysOfWeek(monday: string): string[] {
  return Array.from({ length: 6 }, (_, i) => addDays(monday, i));
}
