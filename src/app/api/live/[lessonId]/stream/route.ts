import { randomUUID } from "node:crypto";
import { currentUser } from "@/lib/server/auth";
import { lessonOr404, listenerLanguage, syncLessonLive } from "@/lib/server/access";
import { hub } from "@/lib/server/live";
import { db } from "@/lib/server/db";
import { qaViewFor } from "@/lib/server/theory";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Server-Sent Events: der Browser bekommt jeden Satz in seiner Sprache.
 * ?original=1 zeigt nur das deutsche Original (spart Übersetzung).
 */
export async function GET(req: Request, ctx: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = await ctx.params;
  const user = await currentUser();
  if (!user) return new Response("Nicht angemeldet", { status: 401 });
  const lesson = lessonOr404(lessonId);
  if (!lesson) return new Response("Stunde nicht gefunden", { status: 404 });
  syncLessonLive(lesson);

  const wantsOriginal = new URL(req.url).searchParams.get("original") === "1";
  const language = wantsOriginal ? null : listenerLanguage(user);
  const encoder = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const write = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          cleanup();
        }
      };
      const unsubscribe = hub().subscribe(lessonId, {
        id: randomUUID(),
        userId: user.id,
        language,
        role: user.role,
        send: (e) => write(`event: ${e.type}\ndata: ${JSON.stringify(e.data)}\n\n`),
      });
      // Aktuelle Fragen sofort mitschicken
      write(`event: qa\ndata: ${JSON.stringify(qaViewFor(db(), lessonId, { id: user.id, role: user.role }))}\n\n`);
      // Hält die Verbindung durch Proxys hindurch offen.
      const ping = setInterval(() => write(`: ping\n\n`), 20_000);
      cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(ping);
        unsubscribe();
        try {
          controller.close();
        } catch {}
      };
      req.signal.addEventListener("abort", cleanup);
      write(`retry: 3000\n\n`);
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
