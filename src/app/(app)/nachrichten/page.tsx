import { redirect } from "next/navigation";
import { requireUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { listMessages, markRead } from "@/lib/server/chat";
import { ChatView } from "@/components/chat/ChatView";

export const dynamic = "force-dynamic";
export const metadata = { title: "Nachrichten" };

export default async function StudentChatPage() {
  const user = await requireUser();
  if (user.role === "teacher") redirect("/verwaltung/nachrichten");
  const msgs = listMessages(db(), user.id, "student");
  markRead(db(), user.id, "student");
  return (
    <>
      <h1>Nachrichten</h1>
      <p className="page-intro">Schreib deiner Fahrlehrerin direkt – auch mit Foto oder PDF. Tippe auf eine Nachricht, um genau darauf zu antworten.</p>
      <ChatView studentId={user.id} side="student" initial={msgs} otherName="Fahrschule" canClear />
    </>
  );
}
