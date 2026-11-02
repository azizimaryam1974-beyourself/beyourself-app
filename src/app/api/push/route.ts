import { auditRequest } from "@/lib/server/audit-context";
import { NextResponse } from "next/server";
import { currentUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { isExpoToken, registerPushToken, removePushToken } from "@/lib/server/push";

/** Die App meldet hier ihr Push-Kennzeichen an (eingeloggt über die Webseite in der App). */
export async function POST(req: Request) {
  void auditRequest(req, "POST /api/push");
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Bitte einloggen." }, { status: 401 });
  const j = (await req.json().catch(() => ({}))) as { token?: unknown; platform?: unknown; remove?: unknown };
  if (!isExpoToken(j.token)) return NextResponse.json({ error: "Ungültig" }, { status: 400 });
  if (j.remove) removePushToken(db(), j.token);
  else registerPushToken(db(), user.id, j.token, typeof j.platform === "string" ? j.platform : "");
  return NextResponse.json({ ok: true });
}
