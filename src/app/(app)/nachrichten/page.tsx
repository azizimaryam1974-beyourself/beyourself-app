import { redirect } from "next/navigation";
import { requireUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { listMessages, markRead } from "@/lib/server/chat";
import { ChatView } from "@/components/chat/ChatView";
import { Avatar } from "@/components/ui/Avatar";
import { getDetails } from "@/lib/server/user-details";

export const dynamic = "force-dynamic";
export const metadata = { title: "Nachrichten" };

export default async function StudentChatPage() {
  const user = await requireUser();
  if (user.role === "teacher") redirect("/verwaltung/nachrichten");
  const teacher = db().prepare(`SELECT id, name FROM users WHERE role = 'teacher' ORDER BY created_at LIMIT 1`).get() as { id: string; name: string } | undefined;
  const tPhoto = teacher ? getDetails(db(), teacher.id).photoAt : null;
  const msgs = listMessages(db(), user.id, "student");
  markRead(db(), user.id, "student");
  return (
    <>
      <div className="chat-head" style={{ marginBottom: 6 }}>
        {teacher && <Avatar id={teacher.id} name={teacher.name} photoAt={tPhoto} size={48} />}
        <h1 style={{ margin: 0 }}>Nachrichten{teacher && <small>{teacher.name} · Fahrschule beyourself</small>}</h1>
      </div>
      <p className="page-intro">Schreib deiner Fahrlehrerin direkt – auch mit Foto oder PDF. Tippe auf eine Nachricht, um genau darauf zu antworten.</p>
      <ChatView studentId={user.id} side="student" initial={msgs} otherName="Fahrschule" canClear />
    </>
  );
}
