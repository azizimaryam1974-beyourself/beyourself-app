import Link from "next/link";
import { requireTeacher } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { listStudents } from "@/lib/server/repo";
import { trainingWithBookings } from "@/lib/server/drive-booking";
import { CLASS_LABEL } from "@/lib/training";
import { getLanguage } from "@/lib/languages";
import { PageHead } from "@/components/PageHead";
import { Avatar } from "@/components/ui/Avatar";
import { grundbetragPaid } from "@/lib/server/training-repo";
import { creditBalance } from "@/lib/server/credit";
import { hasIdDocument } from "@/lib/server/student-docs";
import { formatPrice } from "@/lib/language-package";
import { addressLine, detailsMap } from "@/lib/server/user-details";

export const metadata = { title: "Schüler" };
export const dynamic = "force-dynamic";

export default async function StudentsPage({ searchParams }: { searchParams: Promise<{ q?: string; ansicht?: string }> }) {
  await requireTeacher();
  const { q, ansicht } = await searchParams;
  const table = ansicht === "tabelle";
  const d = db();
  const query = (q ?? "").trim().toLowerCase();
  const students = listStudents(d).filter((s) => !query || s.name.toLowerCase().includes(query) || s.email.includes(query) || (s.phone ?? "").includes(query));
  const det = detailsMap(d);
  const rows = students.map((s) => ({ s, t: trainingWithBookings(d, s.id) }));

  return (
    <>
      <PageHead title="Schüler" intro="Tippe auf einen Schüler, um seine Akte zu öffnen: Ausbildungsstand, Stunden, Testfahrt, Prüfungsreife, Unterlagen und Sprachpaket." />
      <div className="fin-tabs">
        <Link href={`/verwaltung${q ? `?q=${encodeURIComponent(q)}` : ""}`} className={`fin-tab ${table ? "" : "on"}`}>Karten</Link>
        <Link href={`/verwaltung?ansicht=tabelle${q ? `&q=${encodeURIComponent(q)}` : ""}`} className={`fin-tab ${table ? "on" : ""}`}>Tabelle (alle Infos)</Link>
      </div>
      <form className="search-row" role="search">
        {table && <input type="hidden" name="ansicht" value="tabelle" />}
        <input type="text" name="q" defaultValue={q} placeholder="Name, E-Mail oder Telefon suchen" aria-label="Schüler suchen" />
        <button className="btn btn-small" type="submit">Suchen</button>
      </form>
      {rows.length === 0 ? (
        <div className="card"><p className="hint">{query ? "Niemand gefunden." : "Noch keine Anmeldungen."}</p></div>
      ) : table ? (
        <StudentTable rows={rows.map(({ s, t }) => ({ s, t }))} det={det} />
      ) : (
        <div className="student-cards">
          {rows.map(({ s, t }) => {
            const pkg = s.pkg && s.pkg.status !== "cancelled" ? s.pkg : null;
            return (
              <Link key={s.id} href={`/verwaltung/schueler/${s.id}`} className="student-card">
                <div className="sc-top">
                  <span className="sc-who"><Avatar id={s.id} name={s.name} photoAt={det.get(s.id)?.photoAt} size={38} /><strong className="sc-name">{s.name}</strong></span>
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
                  <span className="hint">{s.phone ?? s.email}{det.get(s.id) && addressLine(det.get(s.id)!) ? ` · ${det.get(s.id)!.city}` : ""}</span>
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

function StudentTable({ rows, det }: { rows: Array<{ s: ReturnType<typeof listStudents>[number]; t: ReturnType<typeof trainingWithBookings> }>; det: ReturnType<typeof detailsMap> }) {
  const d = db();
  const teacher = (d.prepare(`SELECT name FROM users WHERE role = 'teacher' ORDER BY created_at LIMIT 1`).get() as { name: string } | undefined)?.name.split(" ")[0] ?? "–";
  const openOf = (id: string) => (d.prepare(`SELECT COALESCE(SUM(price_cents - credit_cents),0) AS s FROM bookings WHERE user_id = ? AND status = 'awaiting_payment'`).get(id) as { s: number }).s;
  return (
    <div className="card fin-list">
      <table className="student-table">
        <thead><tr><th>Schüler</th><th>Klasse</th><th>Stand</th><th className="num">Gefahren</th><th>Grundbetrag</th><th className="num">Offen</th><th className="num">Guthaben</th><th>Ausweis</th><th>Lehrer/in</th></tr></thead>
        <tbody>
          {rows.map(({ s, t }) => {
            const done = t ? t.records.filter((r) => r.status === "done").reduce((a, r) => a + r.minutes, 0) : 0;
            const open = openOf(s.id), credit = creditBalance(d, s.id);
            const grund = t?.profile.grundWaived || grundbetragPaid(d, s.id);
            return (
              <tr key={s.id}>
                <td><Link href={`/verwaltung/schueler/${s.id}`} className="st-name"><Avatar id={s.id} name={s.name} photoAt={det.get(s.id)?.photoAt} size={30} />{s.name}</Link><small>{s.phone ?? s.email}</small></td>
                <td data-label="Klasse">{t ? CLASS_LABEL[t.profile.licenseClass] : <span className="badge badge-warn">fehlt</span>}</td>
                <td data-label="Stand">{t ? (t.profile.passedAt ? "bestanden ✓" : t.state.current?.title ?? "fertig") : "–"}{t && !t.profile.passedAt && <small>{t.state.percent} %</small>}</td>
                <td data-label="Gefahren" className="num">{(done / 60).toFixed(1).replace(".", ",")} Std.</td>
                <td data-label="Grundbetrag">{grund ? <span className="badge badge-ok">bezahlt</span> : <span className="badge badge-warn">offen</span>}</td>
                <td data-label="Offen" className="num">{open ? formatPrice(open) : "–"}</td>
                <td data-label="Guthaben" className="num">{credit ? formatPrice(credit) : "–"}</td>
                <td data-label="Ausweis">{hasIdDocument(d, s.id) ? "✓" : <span className="badge badge-error">fehlt</span>}</td>
                <td data-label="Lehrer/in">{teacher}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
