import Link from "next/link";
import { requireTeacher } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { listStudents } from "@/lib/server/repo";
import { trainingWithBookings } from "@/lib/server/drive-booking";
import { CLASS_LABEL } from "@/lib/training";
import { getLanguage } from "@/lib/languages";
import { PageHead } from "@/components/PageHead";

export const metadata = { title: "Schüler" };
export const dynamic = "force-dynamic";

export default async function StudentsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireTeacher();
  const { q } = await searchParams;
  const d = db();
  const query = (q ?? "").trim().toLowerCase();
  const students = listStudents(d).filter((s) => !query || s.name.toLowerCase().includes(query) || s.email.includes(query) || (s.phone ?? "").includes(query));
  const rows = students.map((s) => ({ s, t: trainingWithBookings(d, s.id) }));

  return (
    <>
      <PageHead title="Schüler" intro="Tippe auf einen Schüler, um seine Akte zu öffnen: Ausbildungsstand, Stunden, Testfahrt, Prüfungsreife, Unterlagen und Sprachpaket." />
      <form className="search-row" role="search">
        <input type="text" name="q" defaultValue={q} placeholder="Name, E-Mail oder Telefon suchen" aria-label="Schüler suchen" />
        <button className="btn btn-small" type="submit">Suchen</button>
      </form>
      {rows.length === 0 ? (
        <div className="card"><p className="hint">{query ? "Niemand gefunden." : "Noch keine Anmeldungen."}</p></div>
      ) : (
        <div className="student-cards">
          {rows.map(({ s, t }) => {
            const pkg = s.pkg && s.pkg.status !== "cancelled" ? s.pkg : null;
            return (
              <Link key={s.id} href={`/verwaltung/schueler/${s.id}`} className="student-card">
                <div className="sc-top">
                  <strong className="sc-name">{s.name}</strong>
                  {t ? <span className="badge">{CLASS_LABEL[t.profile.licenseClass]}</span> : <span className="badge badge-warn">Klasse fehlt</span>}
                </div>
                {t ? (
                  <>
                    <div className="sc-phase">{t.state.current?.title ?? "Fertig"}</div>
                    <div className="mini-bar" aria-label={`${t.state.percent} Prozent`}><span style={{ width: `${t.state.percent}%` }} /></div>
                    <div className="hint">{t.state.percent} % geschafft{t.profile.blocked ? " · Buchen gesperrt" : t.profile.manualApproval ? " · nur mit Freigabe" : ""}</div>
                  </>
                ) : <div className="hint">Bitte Klasse in der Akte festlegen.</div>}
                <div className="sc-foot">
                  <span className="hint">{s.phone ?? s.email}</span>
                  {pkg && <span className={`badge ${pkg.status === "paid" ? "badge-ok" : "badge-warn"}`}>Sprache: {getLanguage(pkg.language)?.labelDe} {pkg.status === "paid" ? "✓" : "· offen"}</span>}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
