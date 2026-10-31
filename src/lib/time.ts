/**
 * Zeiten: gespeichert als Millisekunden (UTC), angezeigt immer in deutscher Zeit
 * (Europe/Berlin, inkl. Sommer-/Winterzeit) – egal, in welcher Zeitzone der Server läuft.
 */
export const TZ = "Europe/Berlin";

const partsFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
});

/** Abstand Berlin–UTC zu einem Zeitpunkt (ms). */
function offsetAt(ms: number): number {
  const p = Object.fromEntries(partsFmt.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return asUtc - Math.floor(ms / 1000) * 1000;
}

/** "2026-11-03" + "08:30" (deutsche Zeit) → Zeitpunkt in ms. */
export function berlinToMs(date: string, time: string): number {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const t = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!d || !t) return NaN;
  const guess = Date.UTC(+d[1], +d[2] - 1, +d[3], +t[1], +t[2]);
  let ms = guess - offsetAt(guess);
  ms = guess - offsetAt(ms); // Umstellungstage
  return ms;
}

/** Zeitpunkt → "YYYY-MM-DD" in deutscher Zeit. */
export function dayKey(ms: number): string {
  const p = Object.fromEntries(partsFmt.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}

/** Wochentag 0 = Montag … 6 = Sonntag für einen Tages-Schlüssel. */
export function weekdayOf(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

export function addDays(key: string, n: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

export function mondayOf(key: string): string {
  return addDays(key, -weekdayOf(key));
}

export function isDayKey(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
}

const fTime = new Intl.DateTimeFormat("de-DE", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
const fDay = new Intl.DateTimeFormat("de-DE", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" });
const fDayShort = new Intl.DateTimeFormat("de-DE", { timeZone: TZ, weekday: "short", day: "2-digit", month: "2-digit" });
const fDate = new Intl.DateTimeFormat("de-DE", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric" });

export const fmtTime = (ms: number) => fTime.format(ms);
export const fmtDay = (ms: number) => fDay.format(ms);
export const fmtDayShort = (ms: number) => fDayShort.format(ms);
export const fmtDate = (ms: number) => fDate.format(ms);
/** "Dienstag, 3. November · 08:30–10:00 Uhr" */
export function fmtSlot(start: number, end: number): string {
  return `${fmtDay(start)} · ${fmtTime(start)}–${fmtTime(end)} Uhr`;
}
/** Tag aus Schlüssel (Mittag, damit keine Zeitzonen-Verschiebung). */
export function keyToNoonMs(key: string): number {
  return berlinToMs(key, "12:00");
}
