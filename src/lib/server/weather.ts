import "server-only";
import { addDays, dayKey } from "../time";

/**
 * Wetter für die Übersicht – Daten des Deutschen Wetterdienstes (DWD) über Bright Sky (api.brightsky.dev):
 * frei nutzbar, ohne Schlüssel. Dazu die amtlichen DWD-Warnungen (Glätte, Sturm, Gewitter …) für Kassel.
 * Wird 30 Minuten zwischengespeichert. Fällt der Dienst aus, zeigt die Übersicht einfach kein Wetter.
 */

const LAT = 51.3127, LON = 9.4797; // Rudolf-Schwander-Str. 9, 34117 Kassel
const TTL = 30 * 60_000;

export interface WeatherDay {
  day: string; min: number; max: number; rainMm: number; gustMax: number; icon: string;
  /** Hinweise für die Fahrstunden, z. B. „Glättegefahr am Morgen“ */
  hints: string[];
}
export interface WeatherAlert { headline: string; severity: string; from: string; until: string }
export interface Weather { now: { temp: number; icon: string } | null; days: WeatherDay[]; alerts: WeatherAlert[] }

interface Hour { timestamp: string; temperature: number | null; precipitation: number | null; wind_gust_speed: number | null; condition: string | null; icon: string | null }

const g = globalThis as unknown as { __byWeather?: { at: number; data: Weather | null } };

async function getJson<T>(url: string): Promise<T | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 4000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { accept: "application/json" } });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

const hourOf = (ts: string) => Number(ts.slice(11, 13));

/** Häufigstes Symbol tagsüber (8–20 Uhr). */
function mainIcon(hours: Hour[]): string {
  const count = new Map<string, number>();
  for (const h of hours) if (h.icon && hourOf(h.timestamp) >= 8 && hourOf(h.timestamp) <= 20) count.set(h.icon, (count.get(h.icon) ?? 0) + 1);
  const severe = ["thunderstorm", "hail", "snow", "sleet", "rain"].find((i) => (count.get(i) ?? 0) >= 2);
  return severe ?? [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "cloudy";
}

function hintsFor(hours: Hour[]): string[] {
  const work = hours.filter((h) => hourOf(h.timestamp) >= 7 && hourOf(h.timestamp) <= 22);
  const out: string[] = [];
  const icy = work.filter((h) => (h.temperature ?? 9) <= 1 && ((h.precipitation ?? 0) > 0 || ["snow", "sleet"].includes(h.condition ?? "")));
  if (icy.length) out.push(`Glättegefahr ab ${String(hourOf(icy[0].timestamp)).padStart(2, "0")} Uhr`);
  else if (work.some((h) => (h.temperature ?? 9) <= 0)) out.push("Frost – Scheiben/Straßen prüfen");
  if (work.some((h) => h.condition === "snow")) out.push("Schnee");
  if (work.some((h) => h.condition === "thunderstorm")) out.push("Gewitter möglich");
  const gust = Math.max(0, ...work.map((h) => h.wind_gust_speed ?? 0));
  if (gust >= 62) out.push(`Sturmböen bis ${Math.round(gust)} km/h`);
  else if (gust >= 50) out.push(`Starke Böen bis ${Math.round(gust)} km/h`);
  if (work.some((h) => h.condition === "fog")) out.push("Nebel");
  return out;
}

async function load(now: number): Promise<Weather | null> {
  const today = dayKey(now);
  const w = await getJson<{ weather?: Hour[] }>(
    `https://api.brightsky.dev/weather?lat=${LAT}&lon=${LON}&date=${today}&last_date=${addDays(today, 3)}&tz=Europe%2FBerlin`);
  if (!w?.weather?.length) return null;
  const a = await getJson<{ alerts?: Array<{ headline_de?: string; severity?: string; onset?: string; expires?: string }> }>(
    `https://api.brightsky.dev/alerts?lat=${LAT}&lon=${LON}&tz=Europe%2FBerlin`);
  const byDay = new Map<string, Hour[]>();
  for (const h of w.weather) {
    const d = h.timestamp.slice(0, 10);
    if (!byDay.has(d)) byDay.set(d, []);
    byDay.get(d)!.push(h);
  }
  const days: WeatherDay[] = [...byDay.entries()].filter(([d]) => d >= today).slice(0, 3).map(([day, hours]) => {
    const temps = hours.map((h) => h.temperature).filter((t): t is number => typeof t === "number");
    return {
      day, min: Math.round(Math.min(...temps)), max: Math.round(Math.max(...temps)),
      rainMm: Math.round(hours.reduce((s, h) => s + (h.precipitation ?? 0), 0) * 10) / 10,
      gustMax: Math.round(Math.max(0, ...hours.map((h) => h.wind_gust_speed ?? 0))),
      icon: mainIcon(hours), hints: hintsFor(hours),
    };
  });
  const nowHour = w.weather.reduce<Hour | null>((best, h) => (Date.parse(h.timestamp) <= now ? h : best), null);
  return {
    now: nowHour && typeof nowHour.temperature === "number" ? { temp: Math.round(nowHour.temperature), icon: nowHour.icon ?? "cloudy" } : null,
    days,
    alerts: (a?.alerts ?? []).slice(0, 4).map((x) => ({ headline: x.headline_de ?? "Wetterwarnung", severity: x.severity ?? "", from: x.onset ?? "", until: x.expires ?? "" })),
  };
}

export async function getWeather(now = Date.now()): Promise<Weather | null> {
  if (g.__byWeather && now - g.__byWeather.at < (g.__byWeather.data ? TTL : 5 * 60_000)) return g.__byWeather.data;
  const data = await load(now).catch(() => null);
  g.__byWeather = { at: now, data };
  return data;
}

export const WEATHER_EMOJI: Record<string, string> = {
  "clear-day": "☀️", "clear-night": "🌙", "partly-cloudy-day": "⛅", "partly-cloudy-night": "☁️", cloudy: "☁️", fog: "🌫️",
  wind: "💨", rain: "🌧️", sleet: "🌨️", snow: "❄️", hail: "🌨️", thunderstorm: "⛈️",
};
