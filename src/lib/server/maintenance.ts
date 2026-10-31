import { db } from "./db";
import { purgeAuthSessionsSafe } from "./maintenance-helpers";
import { purgeOldSegments } from "./repo";

/** Aufbewahrung der Unterrichtsprotokolle in Tagen (Standard 180). */
export function retentionDays(): number {
  const n = Number(process.env.LESSON_RETENTION_DAYS);
  return Number.isFinite(n) && n > 0 ? n : 180;
}

export function runMaintenance(): void {
  try {
    const removed = purgeOldSegments(db(), retentionDays());
    purgeAuthSessionsSafe();
    if (removed) console.log(`[wartung] ${removed} alte Unterrichtssätze gelöscht (Frist ${retentionDays()} Tage)`);
  } catch (e) {
    console.error("[wartung] fehlgeschlagen", e);
  }
}

const g = globalThis as unknown as { __byMaintenance?: ReturnType<typeof setInterval> };

/** Beim Serverstart und dann alle 24 Stunden. */
export function startMaintenance(): void {
  if (g.__byMaintenance) return;
  runMaintenance();
  g.__byMaintenance = setInterval(runMaintenance, 24 * 60 * 60 * 1000);
  g.__byMaintenance.unref?.();
}
