import { currentUser } from "@/lib/server/auth";
import { lessonOr404 } from "@/lib/server/access";
import { hub } from "@/lib/server/live";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = await ctx.params;
  const user = await currentUser();
  if (!user || user.role !== "teacher") return Response.json({ error: "Nur für Lehrkräfte" }, { status: 403 });
  if (!lessonOr404(lessonId)) return Response.json({ error: "Stunde nicht gefunden" }, { status: 404 });
  const h = hub();
  return Response.json(
    { listeners: h.listenerCount(lessonId), languages: h.activeLanguages(lessonId) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
