import { db } from "./db";
import { writeAudit } from "./audit";

export function logRequestError(err: unknown, request: { path: string; method: string; headers: Record<string, string | string[] | undefined> }, context: { routePath: string; routeType: string }): void {
  try {
    const e = err as Error & { digest?: string };
    if (e?.message === "NEXT_REDIRECT" || e?.digest?.startsWith("NEXT_REDIRECT") || e?.digest?.startsWith("NEXT_NOT_FOUND") || e?.digest?.startsWith("NEXT_HTTP_ERROR")) return;
    const h = request.headers;
    const ip = String(h["x-forwarded-for"] ?? "").split(",")[0].trim() || null;
    writeAudit(db(), { kind: "error", action: `Fehler: ${(e?.message ?? String(err)).slice(0, 100)}`, ip, ua: String(h["user-agent"] ?? "") || null,
      target: `${request.method} ${request.path}`, ok: false,
      details: { meldung: e?.message, digest: e?.digest, route: context.routePath, art: context.routeType, stack: (e?.stack ?? "").split("\n").slice(0, 6).join(" | ") } });
  } catch { /* nie die App stören */ }
}
