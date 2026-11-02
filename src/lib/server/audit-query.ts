import { addDays, berlinToMs, dayKey } from "../time";
import type { AuditFilter } from "./audit";

export interface AuditParams { zeit?: string; art?: string; wer?: string; q?: string; fehler?: string; seite?: string }

export function parseAudit(p: AuditParams, now = Date.now()): AuditFilter & { zeit: string; page: number } {
  const today = dayKey(now);
  const zeit = p.zeit || "7";
  const from = zeit === "heute" ? berlinToMs(today, "00:00") : zeit === "alle" ? undefined : berlinToMs(addDays(today, -Number(zeit || 7) + 1), "00:00");
  const page = Math.max(1, Number(p.seite) || 1);
  return { zeit, from, kind: p.art || undefined, actorId: p.wer || undefined, q: p.q?.trim() || undefined, onlyErrors: p.fehler === "1", limit: 200, offset: (page - 1) * 200, page };
}
