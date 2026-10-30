import Link from "next/link";
import { requireTeacher } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { listLessons } from "@/lib/server/repo";
import { speechConfigured, translator } from "@/lib/server/live";
import { createLessonAction } from "../actions";

export const metadata = { title: "Unterricht" };
export const dynamic = "force-dynamic";

const LABEL = { planned: "Geplant", live: "LIVE", ended: "Beendet" } as const;

export default async function TeacherHome() {
  await requireTeacher();
  const lessons = listLessons(db(), 40);
  const provider = translator().name;
  const today = new Date().toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "2-digit" });

  return (
    <>
      <h1>Theorieunterricht</h1>
      {(provider === "mock" || !speechConfigured()) && (
        <div className="alert alert-info">
          <strong>Testmodus:</strong>{" "}
          {provider === "mock" && "Übersetzung läuft mit dem Test-Dienst (kein Azure). "}
          {!speechConfigured() && "Spracherkennung ist nicht eingerichtet – Sätze können per Tastatur gesendet werden. "}
          Schlüssel in der <span className="mono">.env</span> eintragen, siehe Anleitung.
        </div>
      )}

      <form action={createLessonAction} className="card">
        <h2>Neue Stunde</h2>
        <div className="row">
          <input name="title" type="text" placeholder="z. B. Lektion 3 – Vorfahrt" defaultValue={`Theorie ${today}`} style={{ flex: "1 1 260px" }} />
          <button className="btn" type="submit">Stunde anlegen</button>
        </div>
      </form>

      <div className="card">
        <h2>Stunden</h2>
        {lessons.length === 0 ? (
          <p className="hint">Noch keine Stunden.</p>
        ) : (
          <ul className="list">
            {lessons.map((l) => (
              <li key={l.id}>
                <span>
                  <span className={`badge ${l.status === "live" ? "badge-live" : l.status === "ended" ? "badge-muted" : ""}`}>{LABEL[l.status]}</span>{" "}
                  {l.title}
                </span>
                <Link className="btn btn-secondary btn-small" href={`/unterricht/${l.id}`}>Öffnen</Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
