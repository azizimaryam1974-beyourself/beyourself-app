import { timingSafeEqual } from "node:crypto";
import { db } from "@/lib/server/db";
import { buildIcs, getIcsToken } from "@/lib/server/ics";
import { writeAudit } from "@/lib/server/audit";

/** Kalender-Abo (webcal) – nur mit dem geheimen Link. */
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const real = getIcsToken(db());
  const ok = !!real && token.length === real.length && timingSafeEqual(Buffer.from(token), Buffer.from(real));
  if (!ok) return new Response("Nicht gefunden", { status: 404 });
  writeAudit(db(), { kind: "api", action: "Kalender-Abo abgerufen", ip: (req.headers.get("x-forwarded-for") ?? "").split(",")[0] || null, ua: req.headers.get("user-agent") });
  return new Response(buildIcs(db()), { headers: { "content-type": "text/calendar; charset=utf-8", "cache-control": "private, max-age=900", "content-disposition": 'inline; filename="beyourself.ics"' } });
}
