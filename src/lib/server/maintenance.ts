import { db } from "./db";
import { purgeAudit, writeAudit } from "./audit";
import { purgeAuthSessionsSafe } from "./maintenance-helpers";
import { endStaleLessons, purgeOldSegments } from "./repo";

/** Aufbewahrung der Unterrichtsprotokolle in Tagen (Standard 180). */
export function retentionDays(): number {
  const n = Number(process.env.LESSON_RETENTION_DAYS);
  return Number.isFinite(n) && n > 0 ? n : 180;
}

export function runMaintenance(): void {
  try {
    const removed = purgeOldSegments(db(), retentionDays());
    purgeAuthSessionsSafe();
    const keep = Number(process.env.AUDIT_RETENTION_DAYS) > 0 ? Number(process.env.AUDIT_RETENTION_DAYS) : 365;
    const gone = purgeAudit(db(), keep);
    writeAudit(db(), { kind: "system", action: "Wartung", details: { protokollGeloescht: gone, aufbewahrungTage: keep, alteUnterrichtssaetze: removed } });
    if (removed) console.log(`[wartung] ${removed} alte Unterrichtssätze gelöscht (Frist ${retentionDays()} Tage)`);
  } catch (e) {
    console.error("[wartung] fehlgeschlagen", e);
  }
}

const g = globalThis as unknown as { __byMaintenance?: ReturnType<typeof setInterval>; __byBookingJobs?: ReturnType<typeof setInterval> };

/** Beim Serverstart und dann alle 24 Stunden. */
export function startMaintenance(): void {
  if (g.__byMaintenance) return;
  runMaintenance();
  g.__byMaintenance = setInterval(runMaintenance, 24 * 60 * 60 * 1000);
  g.__byMaintenance.unref?.();
  // Zahlungsfristen (30 Min) und Erinnerungen: jede Minute prüfen.
  const jobs = () => {
    try {
      // Vergessene Live-Stunden beenden (auch für verbundene Schüler)
      const hub = (globalThis as unknown as { __byHub?: { setLive(id: string, live: boolean): void } }).__byHub;
      for (const id of endStaleLessons(db())) hub?.setLive(id, false);
    } catch (e) { console.error("[unterricht] Hintergrund", e); }
    return import("./payments/service").then((m) => m.runBookingJobs()).catch((e) => console.error("[buchung] Hintergrund", e));
  };
  g.__byBookingJobs = setInterval(jobs, 60_000);
  g.__byBookingJobs.unref?.();
  void jobs();
}
