import { currentUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { getLesson, listSegments } from "@/lib/server/repo";
import { listenerLanguage } from "@/lib/server/access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Bisherige Sätze einer Stunde in der Sprache des Schülers (zum Nachlesen / Einstieg). */
export async function GET(_req: Request, ctx: { params: Promise<{ lessonId: string }> }) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Nicht angemeldet" }, { status: 401 });
  const { lessonId } = await ctx.params;
  const lesson = getLesson(db(), lessonId);
  if (!lesson || lesson.status === "planned") return Response.json({ error: "Stunde nicht gefunden" }, { status: 404 });
  const code = listenerLanguage(user);
  const captions = listSegments(db(), lessonId).slice(-400).map((s) => ({
    seq: s.seq,
    original: s.original,
    text: code ? s.translations[code] ?? null : s.original,
  }));
  return Response.json(
    { lesson: { id: lesson.id, title: lesson.title, status: lesson.status }, captions },
    { headers: { "Cache-Control": "no-store" } },
  );
}
