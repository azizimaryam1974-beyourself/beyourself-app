import Link from "next/link";
import { redirect } from "next/navigation";
import { requireTeacher } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { listThreads } from "@/lib/server/chat";
import { fmtDayShort, fmtTime } from "@/lib/time";
import { addressLine, detailsMap } from "@/lib/server/user-details";
import { Avatar } from "@/components/ui/Avatar";

export const dynamic = "force-dynamic";
export const metadata = { title: "Nachrichten" };

export default async function SchoolChats({ searchParams }: { searchParams: Promise<{ an?: string }> }) {
  await requireTeacher();
  const { an } = await searchParams;
  if (an) redirect(`/verwaltung/nachrichten/${encodeURIComponent(an)}`);
  const threads = listThreads(db());
  const students = db().prepare(`SELECT id, name FROM users WHERE role = 'student' ORDER BY name`).all() as Array<{ id: string; name: string }>;
  const det = detailsMap(db());
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(Date.now());
  return (
    <>
      <h1>Nachrichten</h1>
      <form className="row chat-new" method="get">
        <select name="an" aria-label="Schüler wählen" defaultValue="" required style={{ width: "auto", flex: "1 1 220px" }}>
          <option value="" disabled>Neue Nachricht an …</option>
          {students.map((s) => { const a = det.get(s.id) ? addressLine(det.get(s.id)!) : ""; return <option key={s.id} value={s.id}>{a ? `${s.name} – ${a}` : `${s.name} – (keine Adresse)`}</option>; })}
        </select>
        <button className="btn btn-gold btn-small" type="submit">Schreiben</button>
      </form>
      <div className="card">
        {threads.length === 0 ? <p className="hint">Noch keine Nachrichten.</p> : (
          <ul className="thread-list">
            {threads.map((t) => (
              <li key={t.studentId}>
                <Link href={`/verwaltung/nachrichten/${t.studentId}`} className={t.unread ? "unread" : ""}>
                  <Avatar id={t.studentId} name={t.name} photoAt={det.get(t.studentId)?.photoAt} size={42} />
                  <span className="thread-main">
                    <strong>{t.name}</strong>
                    <span>{t.lastSender === "school" ? "Du: " : ""}{t.last}</span>
                  </span>
                  <span className="thread-meta">
                    <small>{new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(t.lastAt) === today ? fmtTime(t.lastAt) : fmtDayShort(t.lastAt)}</small>
                    {t.unread > 0 && <span className="tab-count">{t.unread}</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
