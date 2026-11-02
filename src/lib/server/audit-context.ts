import "server-only";
import { cookies, headers } from "next/headers";
import { db } from "./db";
import { hashToken } from "./password";
import { userForSession } from "./repo";
import { writeAudit, type AuditEvent, type AuditKind } from "./audit";

/** Wer ist es, von wo? (aus Cookie/Bearer und Kopfzeilen der Anfrage) */
async function context(): Promise<{ actor: AuditEvent["actor"]; ip: string | null; ua: string | null; path: string | null }> {
  try {
    const h = await headers();
    const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || null;
    const auth = (h.get("authorization") ?? "").match(/^Bearer\s+([A-Za-z0-9_-]{20,})$/)?.[1];
    let token = auth ?? null;
    if (!token) { try { token = (await cookies()).get("by_session")?.value ?? null; } catch { token = null; } }
    const u = token ? userForSession(db(), hashToken(token)) : undefined;
    return { actor: u ? { id: u.id, name: u.name, role: u.role } : null, ip, ua: h.get("user-agent"), path: h.get("x-by-path") };
  } catch {
    return { actor: null, ip: null, ua: null, path: null };
  }
}

/** Ein Ereignis mit Wer/Woher protokollieren. */
export async function audit(kind: AuditKind, action: string, opts: { target?: string | null; details?: Record<string, unknown>; ok?: boolean; actor?: AuditEvent["actor"] } = {}): Promise<void> {
  const c = await context();
  writeAudit(db(), { kind, action, actor: opts.actor ?? c.actor, ip: c.ip, ua: c.ua, target: opts.target ?? c.path, details: opts.details, ok: opts.ok });
}

/** Jede Server-Aktion (Formular) ruft das als Erstes auf – automatisch eingebaut. */
export async function auditAction(name: string, args: unknown[]): Promise<void> {
  const list = Array.from(args as ArrayLike<unknown>);
  const form = list.find((a) => typeof FormData !== "undefined" && a instanceof FormData) as FormData | undefined;
  await audit("action", name, { details: form ? (form as unknown as Record<string, unknown>) : { argumente: list.filter((a) => typeof a !== "object" || a === null) } });
}

/** Jede API-Anfrage (Hochladen, Bezahlen, Datei ansehen …). */
export async function auditRequest(req: Request, name: string): Promise<void> {
  const u = new URL(req.url);
  await audit("api", name, { target: `${req.method} ${u.pathname}${u.search}` });
}
