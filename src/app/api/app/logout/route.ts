import { db } from "@/lib/server/db";
import { bearerToken } from "@/lib/server/auth";
import { hashToken } from "@/lib/server/password";
import { deleteAuthSession } from "@/lib/server/repo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  const token = await bearerToken();
  if (token) deleteAuthSession(db(), hashToken(token));
  return Response.json({ ok: true });
}
