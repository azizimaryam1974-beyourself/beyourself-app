import Link from "next/link";
import { requireTeacher } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { listLessons } from "@/lib/server/repo";
import { speechConfigured, translator } from "@/lib/server/live";
import { createLessonAction, endLessonAction } from "@/app/actions";
import { fmtDate, fmtTime } from "@/lib/time";
import { PageHead } from "@/components/PageHead";
import { retentionDays } from "@/lib/server/maintenance";
import { signupCount, upcomingLessons } from "@/lib/server/theory";
import { deleteLessonAction } from "@/app/theory-actions";
import { ScheduleForm } from "./ScheduleForm";
import { dayKey, fmtDay } from "@/lib/time";

export const metadata = { title: "Live-Unterricht" };
export const dynamic = "force-dynamic";

const LABEL = { planned: "Angelegt", live: "LIVE", ended: "Beendet" } as const;

function duration(a: string | null, b: string | null): string {
  if (!a) return "";
  const min = Math.round(((b ? Date.parse(b) : Date.now()) - Date.parse(a)) / 60_000);
  return min < 60 ? `${min} Min` : `${Math.floor(min / 60)} Std ${min % 60} Min`;
}

export default async function TeacherHome() {
  await requireTeacher();
  const lessons = listLessons(db(), 40).filter((l) => !l.scheduled_at || l.status !== "planned");
  const upcoming = upcomingLessons(db(), Date.now() - 4 * 3_600_000, Date.now() + 60 * 86_400_000);
  const provider = translator().name;
  const now = Date.now();
  const title = `Theorie ${new Date(now).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin", weekday: "short", day: "2-digit", month: "2-digit" })}, ${fmtTime(now)} Uhr`;

  return (
    <>
      <PageHead title="Live-Unterricht" intro="Für den Theorieunterricht im Raum: Du sprichst ganz normal, deine Schüler lesen auf dem Handy mit – übersetzt in ihre Sprache und auf Wunsch vorgelesen." />
      {(provider === "mock" || !speechConfigured()) && (
        <div className="alert alert-info">
          <strong>Testmodus:</strong>{" "}
          {provider === "mock" && "Übersetzung läuft mit dem Test-Dienst. "}
          {!speechConfigured() && "Spracherkennung ist nicht eingerichtet – Sätze können per Tastatur gesendet werden. "}
        </div>
      )}

      <section className="card how">
        <h2>So funktioniert es</h2>
        <ol className="how-steps">
          <li><strong>Stunde anlegen</strong> und öffnen – am besten auf deinem Laptop oder Handy mit Mikrofon.</li>
          <li><strong>„Stunde starten“</strong> tippen. Erst jetzt hört das Mikrofon zu. Schüler mit Sprachpaket sehen unter „Mein Konto“ die laufende Stunde.</li>
          <li>Du sprichst – jeder Satz erscheint nach 1–2 Sekunden <strong>als Text</strong> auf den Handys, übersetzt in die gebuchte Sprache.</li>
          <li>Am Ende <strong>„Beenden“</strong> tippen. Die Schüler können die Stunde danach noch {retentionDays()} Tage nachlesen.</li>
        </ol>
        <p className="hint">Es gibt <strong>kein Video und keine Aufnahme</strong>: Übertragen wird nur der erkannte Text deiner Sätze, keine Stimme und kein Bild. Eine Stunde hat keine feste Uhrzeit – sie läuft von „Stunde starten“ bis „Beenden“.
          Vergisst du das Beenden, endet sie automatisch, wenn sie länger als 3 Stunden läuft und 30 Minuten nichts mehr gesprochen wurde.</p>
      </section>

      <section className="card">
        <h2>Theorie-Termine planen</h2>
        <p className="hint">Geplante Termine sehen deine Schüler unter „Theorie“ und melden sich an (im Raum oder von zu Hause). Nur Angemeldete können in der Stunde Fragen stellen. Fahrstunden sind in dieser Zeit automatisch gesperrt.</p>
        <ScheduleForm today={dayKey(now)} />
        {upcoming.length > 0 && (
          <ul className="list" style={{ marginTop: 14 }}>
            {upcoming.map((l) => {
              const c = signupCount(db(), l.id);
              return (
                <li key={l.id}>
                  <span>
                    <strong>{l.title}</strong>
                    <span className="hint" style={{ display: "block" }}>{fmtDay(l.scheduled_at!)} · {fmtTime(l.scheduled_at!)} Uhr · {l.duration_min} Min · angemeldet: {c.raum} im Raum, {c.zuhause} von zu Hause</span>
                  </span>
                  <span className="row">
                    <Link className="btn btn-small" href={`/unterricht/${l.id}`}>{l.status === "live" ? "Zur Stunde" : "Öffnen / starten"}</Link>
                    {l.status === "planned" && (
                      <form action={deleteLessonAction}><input type="hidden" name="lessonId" value={l.id} /><button className="link-btn" type="submit">löschen</button></form>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <form action={createLessonAction} className="card">
        <h2>Spontane Stunde (ohne Termin)</h2>
        <div className="row">
          <input name="title" type="text" placeholder="z. B. Lektion 3 – Vorfahrt" defaultValue={title} style={{ flex: "1 1 260px" }} aria-label="Name der Stunde" />
          <button className="btn" type="submit">Stunde anlegen</button>
        </div>
        <p className="hint" style={{ marginBottom: 0 }}>Tipp: Gib der Stunde das Thema als Namen (z. B. „Lektion 5 – Vorfahrt“). So finden Schüler sie beim Nachlesen leichter.</p>
      </form>

      <div className="card">
        <h2>Laufende und vergangene Stunden</h2>
        {lessons.length === 0 ? (
          <p className="hint">Noch keine Stunden.</p>
        ) : (
          <ul className="list">
            {lessons.map((l) => (
              <li key={l.id}>
                <span>
                  <span className={`badge ${l.status === "live" ? "badge-live" : l.status === "ended" ? "badge-muted" : ""}`}>{LABEL[l.status]}</span>{" "}
                  <strong>{l.title}</strong>
                  <span className="hint" style={{ display: "block" }}>
                    {l.started_at ? `gestartet ${fmtDate(Date.parse(l.started_at))} um ${fmtTime(Date.parse(l.started_at))} Uhr · ${l.status === "live" ? "läuft seit" : "Dauer"} ${duration(l.started_at, l.ended_at)}` : `angelegt ${fmtDate(Date.parse(l.created_at))} – noch nicht gestartet`}
                  </span>
                </span>
                <span className="row">
                  {l.status === "live" && (
                    <form action={endLessonAction}><input type="hidden" name="lessonId" value={l.id} />
                      <button className="btn btn-danger btn-small" type="submit">Beenden</button></form>
                  )}
                  <Link className="btn btn-secondary btn-small" href={`/unterricht/${l.id}`}>Öffnen</Link>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
