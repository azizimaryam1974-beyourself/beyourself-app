import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTeacher } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { getUser } from "@/lib/server/repo";
import { listMessages, markRead } from "@/lib/server/chat";
import { ChatView } from "@/components/chat/ChatView";
import { Avatar } from "@/components/ui/Avatar";
import { addressLine, getDetails } from "@/lib/server/user-details";

export const dynamic = "force-dynamic";
export const metadata = { title: "Nachrichten" };

export default async function SchoolChat({ params }: { params: Promise<{ studentId: string }> }) {
  await requireTeacher();
  const { studentId } = await params;
  const s = getUser(db(), studentId);
  if (!s || s.role !== "student") notFound();
  const det = getDetails(db(), studentId);
  const msgs = listMessages(db(), studentId, "school");
  markRead(db(), studentId, "school");
  return (
    <>
      <Link className="back-link" href="/verwaltung/nachrichten">← Alle Nachrichten</Link>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
        <div className="chat-head" style={{ marginBottom: 8 }}>
          <Avatar id={s.id} name={s.name} photoAt={det.photoAt} size={48} />
          <h1 style={{ margin: 0 }}>{s.name}{addressLine(det) && <small>{addressLine(det)}</small>}</h1>
        </div>
        <span className="row">
          {s.phone && <a className="btn btn-secondary btn-small" href={`tel:${s.phone}`}>Anrufen</a>}
          <Link className="btn btn-secondary btn-small" href={`/verwaltung/schueler/${s.id}`}>Schülerakte</Link>
        </span>
      </div>
      <ChatView studentId={s.id} side="school" initial={msgs} otherName={s.name.split(" ")[0]} />
    </>
  );
}
