import { currentUser } from "@/lib/server/auth";
import { lessonOr404, syncLessonLive } from "@/lib/server/access";
import { hub } from "@/lib/server/live";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_LEN = 2000;

export async function POST(req: Request, ctx: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = await ctx.params;
  const user = await currentUser();
  if (!user || user.role !== "teacher") return Response.json({ error: "Nur für Lehrkräfte" }, { status: 403 });
  const lesson = lessonOr404(lessonId);
  if (!lesson) return Response.json({ error: "Stunde nicht gefunden" }, { status: 404 });
  if (lesson.status !== "live") return Response.json({ error: "Die Stunde ist nicht live" }, { status: 409 });

  const body = (await req.json().catch(() => null)) as { text?: unknown } | null;
  const text = typeof body?.text === "string" ? body.text.trim().slice(0, MAX_LEN) : "";
  if (!text) return Response.json({ error: "Kein Text" }, { status: 400 });

  syncLessonLive(lesson);
  // Nicht auf die Übersetzung warten: die Konsole soll sofort weitermachen.
  void hub().publish(lessonId, text);
  return Response.json({ ok: true }, { status: 202 });
}
