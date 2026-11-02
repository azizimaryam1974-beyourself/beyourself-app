import { auditRequest } from "@/lib/server/audit-context";
import { NextResponse } from "next/server";
import { currentUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { getLesson } from "@/lib/server/repo";
import { pushQa } from "@/lib/server/qa";
import {
  addQuestion, isMuted, lastQuestionAt, mayParticipate, raiseHand, setBeamer, setMuted, setQuestionStatus, type QuestionStatus,
} from "@/lib/server/theory";
import { moderateQuestion } from "@/lib/moderation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WAIT_MS = 20_000; // Zeit zwischen zwei Fragen pro Schüler

/**
 * Fragen & Hand heben (Schüler) und Steuerung (Fahrschule).
 * Schüler:    {action:"ask", text} | {action:"hand", up}
 * Fahrschule: {action:"beamer", id|null} | {action:"status", id, status} | {action:"mute", userId, muted} | {action:"lower", userId}
 */
export async function POST(req: Request, ctx: { params: Promise<{ lessonId: string }> }) {
  void auditRequest(req, "POST /api/live/[lessonId]/qa");
  const { lessonId } = await ctx.params;
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Bitte anmelden." }, { status: 401 });
  const lesson = getLesson(db(), lessonId);
  if (!lesson) return NextResponse.json({ error: "Stunde nicht gefunden." }, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const d = db();

  if (user.role === "teacher") {
    switch (body.action) {
      case "beamer": setBeamer(d, lessonId, typeof body.id === "string" ? body.id : null); break;
      case "status":
        if (typeof body.id === "string" && ["visible", "hidden", "answered", "blocked"].includes(String(body.status))) setQuestionStatus(d, lessonId, body.id, body.status as QuestionStatus);
        break;
      case "mute": if (typeof body.userId === "string") setMuted(d, lessonId, body.userId, body.muted !== false); break;
      case "lower": if (typeof body.userId === "string") raiseHand(d, lessonId, body.userId, false); break;
      default: return NextResponse.json({ error: "Unbekannte Aktion" }, { status: 400 });
    }
    pushQa(lessonId);
    return NextResponse.json({ ok: true });
  }

  // ---- Schüler ----
  if (lesson.status !== "live") return NextResponse.json({ error: "Die Stunde läuft gerade nicht." }, { status: 409 });
  if (!mayParticipate(d, lesson, user.id)) return NextResponse.json({ error: "Bitte melde dich zuerst für diese Stunde an." }, { status: 403 });
  if (isMuted(d, lessonId, user.id)) return NextResponse.json({ error: "Die Fahrschule hat Fragen für dich in dieser Stunde ausgeschaltet." }, { status: 403 });

  if (body.action === "hand") {
    raiseHand(d, lessonId, user.id, body.up !== false);
    pushQa(lessonId);
    return NextResponse.json({ ok: true });
  }
  if (body.action === "ask") {
    const text = String(body.text ?? "").trim();
    if (text.length < 3) return NextResponse.json({ error: "Bitte schreib deine Frage." }, { status: 400 });
    if (text.length > 300) return NextResponse.json({ error: "Bitte höchstens 300 Zeichen." }, { status: 400 });
    const wait = lastQuestionAt(d, lessonId, user.id) + WAIT_MS - Date.now();
    if (wait > 0) return NextResponse.json({ error: `Bitte warte noch ${Math.ceil(wait / 1000)} Sekunden.` }, { status: 429 });
    const key = process.env.ANTHROPIC_API_KEY;
    const m = await moderateQuestion(text, key ? { apiKey: key, model: process.env.CLAUDE_MODEL } : undefined);
    addQuestion(d, { lessonId, userId: user.id, original: text, lang: m.lang, german: m.german, allowed: m.allowed, reason: m.reason });
    pushQa(lessonId);
    return NextResponse.json({ ok: true, shown: m.allowed });
  }
  return NextResponse.json({ error: "Unbekannte Aktion" }, { status: 400 });
}
