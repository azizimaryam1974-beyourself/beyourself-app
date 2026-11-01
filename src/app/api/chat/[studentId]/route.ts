import { NextResponse } from "next/server";
import { currentUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { getUser } from "@/lib/server/repo";
import { listMessages, markRead, sendMessage, shouldMail, unreadForSchool } from "@/lib/server/chat";
import { storeUpload, UploadError } from "@/lib/server/uploads";
import { addNotification } from "@/lib/server/booking";
import { sendMail } from "@/lib/server/mail";
import { appUrl } from "@/lib/server/payments/service";

type Ctx = { params: Promise<{ studentId: string }> };

/** Wer darf dieses Gespräch sehen? Der Schüler selbst oder die Fahrschule. */
async function access(studentId: string) {
  const user = await currentUser();
  if (!user) return null;
  const student = getUser(db(), studentId);
  if (!student || student.role !== "student") return null;
  if (user.role === "teacher") return { user, student, side: "school" as const };
  if (user.id === studentId) return { user, student, side: "student" as const };
  return null;
}

export async function GET(req: Request, { params }: Ctx) {
  const a = await access((await params).studentId);
  if (!a) return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  const after = Number(new URL(req.url).searchParams.get("after") ?? 0) || 0;
  const messages = listMessages(db(), a.student.id, a.side, after);
  if (messages.some((m) => m.sender !== a.side && !m.readAt)) markRead(db(), a.student.id, a.side);
  return NextResponse.json({ messages, schoolUnread: a.side === "school" ? unreadForSchool(db()) : undefined });
}

export async function POST(req: Request, { params }: Ctx) {
  const a = await access((await params).studentId);
  if (!a) return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  const form = await req.formData();
  const body = String(form.get("body") ?? "");
  const replyTo = String(form.get("replyTo") ?? "") || null;
  const f = form.get("file");
  try {
    const file = f instanceof File && f.size > 0 ? await storeUpload(f, "chat") : null;
    if (!body.trim() && !file) return NextResponse.json({ error: "Bitte etwas schreiben oder eine Datei anhängen." }, { status: 400 });
    const m = sendMessage(db(), { studentId: a.student.id, sender: a.side, senderId: a.user.id, body, replyTo, file });
    markRead(db(), a.student.id, a.side);
    const text = body.trim() ? body.trim().slice(0, 300) : `📎 ${file?.name}`;
    if (a.side === "student") {
      const teachers = db().prepare(`SELECT id FROM users WHERE role = 'teacher'`).all() as Array<{ id: string }>;
      for (const t of teachers) addNotification(db(), t.id, null, `Nachricht von ${a.student.name}`, text);
      if (shouldMail(db(), a.student.id, "school")) {
        sendMail(process.env.ADMIN_EMAIL || "info@fahrschule-beyourself.de", `Neue Nachricht von ${a.student.name}`,
          `${a.student.name} schreibt:\n\n${text}\n\nAntworten: ${appUrl()}/verwaltung/nachrichten/${a.student.id}`);
      }
    } else {
      addNotification(db(), a.student.id, null, "Neue Nachricht von der Fahrschule", text);
      if (shouldMail(db(), a.student.id, "student") && !a.student.email.endsWith("@invalid")) {
        sendMail(a.student.email, "Neue Nachricht von deiner Fahrschule",
          `Hallo ${a.student.name.split(" ")[0]},\n\ndu hast eine neue Nachricht:\n\n${text}\n\nAntworten: ${appUrl()}/nachrichten\n\nViele Grüße\nFahrschule beyourself`);
      }
    }
    return NextResponse.json({ message: m });
  } catch (e) {
    if (e instanceof UploadError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[chat]", (e as Error).message);
    return NextResponse.json({ error: "Senden hat nicht geklappt. Bitte noch einmal versuchen." }, { status: 500 });
  }
}
