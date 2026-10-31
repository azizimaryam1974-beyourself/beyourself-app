import { requireTeacher } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { listStudents } from "@/lib/server/repo";
import { bookableLanguages, getLanguage } from "@/lib/languages";
import { formatPrice } from "@/lib/language-package";
import { setPackageLanguageAction, setPackageStatusAction, teacherBookAction } from "@/app/actions";
import { StudentTools } from "./StudentTools";
import { AdminTabs } from "./AdminTabs";
import Link from "next/link";
import { trainingWithBookings as trainingStateFor } from "@/lib/server/drive-booking";
import { CLASS_LABEL } from "@/lib/training";

export const metadata = { title: "Verwaltung" };
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireTeacher();
  const students = listStudents(db());
  const langs = bookableLanguages();
  const active = students.filter((s) => s.pkg && s.pkg.status !== "cancelled");
  const open = active.filter((s) => s.pkg!.status === "booked");
  const sumOpen = open.reduce((a, s) => a + s.pkg!.priceCents, 0);
  const sumPaid = active.filter((s) => s.pkg!.status === "paid").reduce((a, s) => a + s.pkg!.priceCents, 0);

  return (
    <>
      <h1>Verwaltung</h1>
      <AdminTabs active="/verwaltung" />
      <div className="grid grid-2">
        <div className="card"><div className="hint">Schüler</div><div className="price">{students.length}</div></div>
        <div className="card">
          <div className="hint">Sprachpakete: offen / bezahlt</div>
          <div className="price">{formatPrice(sumOpen)} <span className="hint">/ {formatPrice(sumPaid)}</span></div>
        </div>
      </div>

      <div className="card">
        <h2>Schüler</h2>
        <p className="hint">Auf den Namen tippen für die Schülerakte: Ausbildungsstand, Stunden, Testfahrt, Prüfungsreife, Unterlagen.</p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Name</th><th>Ausbildung</th><th>Kontakt</th><th>Sprachpaket</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {students.length === 0 && <tr><td colSpan={6} className="hint">Noch keine Anmeldungen.</td></tr>}
              {students.map((s) => {
                const pkg = s.pkg && s.pkg.status !== "cancelled" ? s.pkg : null;
                const t = trainingStateFor(db(), s.id);
                return (
                  <tr key={s.id}>
                    <td><Link href={`/verwaltung/schueler/${s.id}`}><strong>{s.name}</strong></Link><div className="hint">seit {new Date(s.created_at).toLocaleDateString("de-DE")}</div></td>
                    <td>
                      {t ? (
                        <Link href={`/verwaltung/schueler/${s.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                          <div><strong>{CLASS_LABEL[t.profile.licenseClass]}</strong> <span className="phase-pill">{t.state.current?.title ?? "fertig"}</span></div>
                          <div className="mini-bar" aria-label={`${t.state.percent} %`}><span style={{ width: `${t.state.percent}%` }} /></div>
                        </Link>
                      ) : <Link className="badge badge-warn" href={`/verwaltung/schueler/${s.id}`}>Klasse festlegen</Link>}
                    </td>
                    <td>{s.email}{s.phone && <div className="hint">{s.phone}</div>}</td>
                    <td>
                      {pkg ? (
                        <form action={setPackageLanguageAction} className="row">
                          <input type="hidden" name="packageId" value={pkg.id} />
                          <select name="language" defaultValue={pkg.language} style={{ width: "auto" }} aria-label="Sprache ändern">
                            {langs.map((l) => <option key={l.code} value={l.code}>{l.labelDe}</option>)}
                            {!langs.some((l) => l.code === pkg.language) && <option value={pkg.language}>{getLanguage(pkg.language)?.labelDe}</option>}
                          </select>
                          <button className="btn btn-secondary btn-small" type="submit">Ändern</button>
                        </form>
                      ) : (
                        <form action={teacherBookAction} className="row">
                          <input type="hidden" name="userId" value={s.id} />
                          <select name="language" style={{ width: "auto" }} aria-label="Sprache">
                            {langs.map((l) => <option key={l.code} value={l.code}>{l.labelDe}</option>)}
                          </select>
                          <button className="btn btn-secondary btn-small" type="submit">Paket buchen</button>
                        </form>
                      )}
                    </td>
                    <td>
                      {!s.pkg ? <span className="badge badge-muted">kein Paket</span>
                        : s.pkg.status === "paid" ? <span className="badge badge-ok">bezahlt {s.pkg.paidAt && new Date(s.pkg.paidAt).toLocaleDateString("de-DE")}</span>
                        : s.pkg.status === "booked" ? <span className="badge badge-warn">offen</span>
                        : <span className="badge badge-muted">storniert</span>}
                    </td>
                    <td>
                      {pkg && (
                        <div className="row">
                          {pkg.status === "booked" && (
                            <form action={setPackageStatusAction}>
                              <input type="hidden" name="packageId" value={pkg.id} />
                              <input type="hidden" name="status" value="paid" />
                              <button className="btn btn-small" type="submit">Als bezahlt</button>
                            </form>
                          )}
                          {pkg.status === "paid" && (
                            <form action={setPackageStatusAction}>
                              <input type="hidden" name="packageId" value={pkg.id} />
                              <input type="hidden" name="status" value="booked" />
                              <button className="btn btn-secondary btn-small" type="submit">Zahlung zurücknehmen</button>
                            </form>
                          )}
                          <form action={setPackageStatusAction}>
                            <input type="hidden" name="packageId" value={pkg.id} />
                            <input type="hidden" name="status" value="cancelled" />
                            <button className="btn btn-secondary btn-small" type="submit">Stornieren</button>
                          </form>
                        </div>
                      )}
                      <StudentTools userId={s.id} name={s.name} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
