import { headers } from "next/headers";
import { db } from "@/lib/server/db";
import { issueAppToken } from "@/lib/server/auth";
import { verifyPassword } from "@/lib/server/password";
import { loginLimiters } from "@/lib/server/rate-limit";
import { findUserByEmail } from "@/lib/server/repo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Login für die Handy-App: liefert ein Token (30 Tage). Gleicher Schutz wie im Web. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { email?: unknown; password?: unknown };
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unbekannt";
  const lim = loginLimiters();
  const wait = Math.max(lim.email.blockedFor(email), lim.ip.blockedFor(ip));
  if (wait > 0) {
    return Response.json({ error: `Zu viele Fehlversuche. Bitte in ${Math.ceil(wait / 60_000)} Minuten erneut versuchen.` }, { status: 429 });
  }
  const user = findUserByEmail(db(), email);
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    lim.email.fail(email);
    lim.ip.fail(ip);
    await new Promise((r) => setTimeout(r, 400));
    return Response.json({ error: "E-Mail oder Passwort stimmt nicht." }, { status: 401 });
  }
  lim.email.reset(email);
  const { token, expiresAt } = issueAppToken(user.id);
  return Response.json({ token, expiresAt }, { headers: { "Cache-Control": "no-store" } });
}
