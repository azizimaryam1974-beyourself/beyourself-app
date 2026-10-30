import { currentUser } from "@/lib/server/auth";
import { maySpeech } from "@/lib/server/access";
import { speechConfigured, speechToken } from "@/lib/server/live";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const noStore = { "Cache-Control": "no-store" };

export async function GET() {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Nicht angemeldet" }, { status: 401, headers: noStore });
  if (!maySpeech(user)) return Response.json({ error: "Kein Sprachpaket" }, { status: 403, headers: noStore });
  if (!speechConfigured()) {
    return Response.json({ error: "Azure Speech ist noch nicht eingerichtet" }, { status: 503, headers: noStore });
  }
  try {
    const t = await speechToken();
    return Response.json({ token: t.token, region: t.region, expiresAt: t.expiresAt }, { headers: noStore });
  } catch (e) {
    console.error("[speech-token]", e);
    return Response.json({ error: "Azure Speech nicht erreichbar" }, { status: 502, headers: noStore });
  }
}
