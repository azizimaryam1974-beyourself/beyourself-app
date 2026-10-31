import Link from "next/link";
import { requireUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { listLessons } from "@/lib/server/repo";
import { signupOf, upcomingLessons } from "@/lib/server/theory";
import { signupAction } from "@/app/theory-actions";
import { fmtDay, fmtTime } from "@/lib/time";
import { PageHead } from "@/components/PageHead";

export const metadata = { title: "Theorie" };
export const dynamic = "force-dynamic";

export default async function TheoryPage({ searchParams }: { searchParams: Promise<{ fehler?: string }> }) {
  const user = await requireUser();
  const { fehler } = await searchParams;
  const d = db();
  const now = Date.now();
  const upcoming = upcomingLessons(d, now - 4 * 3_600_000, now + 35 * 86_400_000);
  const live = listLessons(d, 10).filter((l) => l.status === "live");
  const past = listLessons(d, 30).filter((l) => l.status === "ended").slice(0, 8);

  return (
    <>
      <PageHead title="Theorie" intro="Melde dich für die Theoriestunden an – im Raum oder von zu Hause. Während der Stunde liest du live mit und kannst Fragen stellen." />
      {fehler && <div className="alert alert-error">{fehler}</div>}

      {live.length > 0 && (
        <section className="card card-accent">
          <h2>Läuft gerade</h2>
          <ul className="list">
            {live.map((l) => (
              <li key={l.id}>
                <span><span className="badge badge-live">LIVE</span> <strong>{l.title}</strong></span>
                <Link className="btn btn-gold" href={`/live/${l.id}`}>Jetzt dabei sein</Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card">
        <h2>Nächste Theoriestunden</h2>
        {upcoming.length === 0 ? <p className="hint">Gerade sind keine Termine geplant. Neue Termine erscheinen hier automatisch.</p> : (
          <ul className="list theory-list">
            {upcoming.map((l) => {
              const mine = signupOf(d, l.id, user.id);
              return (
                <li key={l.id}>
                  <div>
                    <strong>{l.title}</strong>
                    <div>{fmtDay(l.scheduled_at!)} · {fmtTime(l.scheduled_at!)}–{fmtTime(l.scheduled_at! + (l.duration_min ?? 90) * 60_000)} Uhr</div>
                    {l.place && <div className="hint">{l.place}</div>}
                    {mine && <span className="badge badge-ok">Angemeldet: {mine === "raum" ? "im Raum" : "von zu Hause"}</span>}
                  </div>
                  <form action={signupAction} className="row">
                    <input type="hidden" name="lessonId" value={l.id} />
                    {l.status === "live" && <Link className="btn btn-gold btn-small" href={`/live/${l.id}`}>Jetzt dabei sein</Link>}
                    {mine !== "raum" && <button className="btn btn-small" name="mode" value="raum" type="submit">Im Raum dabei</button>}
                    {mine !== "zuhause" && <button className="btn btn-secondary btn-small" name="mode" value="zuhause" type="submit">Von zu Hause</button>}
                    {mine && <button className="link-btn" name="mode" value="off" type="submit">abmelden</button>}
                  </form>
                </li>
              );
            })}
          </ul>
        )}
        <p className="hint">Hinweis: Teilnahme von zu Hause zählt erst als Pflicht-Theoriestunde, wenn die geplante Führerscheinreform beschlossen ist.
          Bis dahin bitte die Pflichtstunden im Raum besuchen.</p>
      </section>

      {past.length > 0 && (
        <section className="card">
          <h2>Vergangene Stunden nachlesen</h2>
          <ul className="list">
            {past.map((l) => (
              <li key={l.id}>
                <span>{l.title}</span>
                <Link className="btn btn-secondary btn-small" href={`/live/${l.id}`}>Öffnen</Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
