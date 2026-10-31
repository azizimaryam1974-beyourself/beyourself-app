import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTeacher } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { getUser } from "@/lib/server/repo";
import { trainingWithBookings as trainingStateFor } from "@/lib/server/drive-booking";
import { examReadyAction, recordStatusAction, saveDocsAction, setClassAction, testfahrtAction } from "@/app/training-actions";
import { CLASS_LABEL, KIND_LABEL, TRAINING_CLASSES, type DriveKind } from "@/lib/training";
import { dayKey, fmtDate } from "@/lib/time";
import { ProgressView } from "@/components/training/ProgressView";
import { AdminTabs } from "../../AdminTabs";
import { AddRecordForm, TargetsForm } from "./Forms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Schülerakte" };

const STATUS_LABEL = { done: "gefahren", planned: "gebucht", no_show: "nicht erschienen", late: "zu spät (ausgefallen)" } as const;
const STATUS_CLS = { done: "badge-ok", planned: "badge-warn", no_show: "badge-muted", late: "badge-muted" } as const;

function kindsFor(c: string): DriveKind[] {
  const base: DriveKind[] = c === "b197" ? ["automatik", "schalter"] : c === "b78" ? ["automatik"] : ["schalter"];
  const special: DriveKind[] = c === "umschreibung" ? [] : ["ueberland", "autobahn", "beleuchtung"];
  return [...base, ...special, "wiederholung", ...(c === "b197" ? (["testfahrt"] as DriveKind[]) : []), "warmstunde"];
}

export default async function StudentFile({ params }: { params: Promise<{ id: string }> }) {
  await requireTeacher();
  const { id } = await params;
  const d = db();
  const user = getUser(d, id);
  if (!user || user.role !== "student") notFound();

  const t = trainingStateFor(d, id);

  return (
    <>
      <p><Link href="/verwaltung">← Alle Schüler</Link></p>
      <div className="student-head">
        <div>
          <h1 style={{ marginBottom: 4 }}>{user.name}</h1>
          <p className="hint" style={{ marginTop: 0 }}>
            {user.phone && <><a href={`tel:${user.phone}`}>{user.phone}</a> · </>}<a href={`mailto:${user.email}`}>{user.email}</a>
            {" · "}seit {fmtDate(Date.parse(user.created_at))}
          </p>
        </div>
        <form action={setClassAction} className="row">
          <input type="hidden" name="userId" value={id} />
          <select name="licenseClass" defaultValue={t?.profile.licenseClass ?? ""} aria-label="Klasse" style={{ width: "auto" }}>
            {!t && <option value="" disabled>Klasse wählen …</option>}
            {TRAINING_CLASSES.map((c) => <option key={c} value={c}>{CLASS_LABEL[c]}</option>)}
          </select>
          <button className="btn btn-secondary btn-small" type="submit">{t ? "Klasse ändern" : "Festlegen"}</button>
        </form>
      </div>
      <AdminTabs active="/verwaltung" />

      {!t ? (
        <div className="card"><p>Für diesen Schüler ist noch keine Klasse festgelegt (Anmeldung vor dem 01.11.2026). Bitte oben auswählen.</p></div>
      ) : (
        <div className="akte-grid">
          <section className="card">
            <h2>Ausbildungsstand</h2>
            <ProgressView state={t.state} classLabel={CLASS_LABEL[t.profile.licenseClass]} />
          </section>

          <div>
            {t.profile.licenseClass === "b197" && (
              <section className="card">
                <h2>Testfahrt</h2>
                {t.profile.testfahrtPassedAt ? (
                  <form action={testfahrtAction} className="row" style={{ justifyContent: "space-between" }}>
                    <input type="hidden" name="userId" value={id} />
                    <span className="badge badge-ok">bestanden am {fmtDate(t.profile.testfahrtPassedAt)}</span>
                    <button className="link-btn" name="result" value="reset" type="submit">zurücknehmen</button>
                  </form>
                ) : (
                  <form action={testfahrtAction} className="akte-form">
                    <input type="hidden" name="userId" value={id} />
                    {t.profile.extraManual > 0 && <p className="hint">Bisher {t.profile.extraManual} zusätzliche Schaltstunden nach nicht bestandener Testfahrt.</p>}
                    <div className="row">
                      <button className="btn btn-small" name="result" value="passed" type="submit">Bestanden</button>
                      <span className="row" style={{ flex: "1 1 220px" }}>
                        <input type="number" name="extra" min={1} max={20} defaultValue={2} aria-label="Zusätzliche Schaltstunden" style={{ width: 80 }} />
                        <button className="btn btn-secondary btn-small" name="result" value="failed" type="submit">Nicht bestanden → Std. dazu</button>
                      </span>
                    </div>
                  </form>
                )}
              </section>
            )}

            <section className="card">
              <h2>Stunden & Regeln</h2>
              <TargetsForm userId={id} isB197={t.profile.licenseClass === "b197"} practiceTarget={t.profile.practiceTarget}
                repeatTarget={t.profile.repeatTarget} maxPerWeek={t.profile.maxPerWeek} manualApproval={t.profile.manualApproval} blocked={t.profile.blocked} />
            </section>

            <section className="card">
              <h2>Prüfungsreife</h2>
              {t.profile.examReadyAt ? (
                <form action={examReadyAction} className="row" style={{ justifyContent: "space-between" }}>
                  <input type="hidden" name="userId" value={id} />
                  <span className="badge badge-ok">bestätigt am {fmtDate(t.profile.examReadyAt)}</span>
                  <button className="link-btn" name="ready" value="0" type="submit">zurücknehmen</button>
                </form>
              ) : (
                <form action={examReadyAction} className="akte-form">
                  <input type="hidden" name="userId" value={id} />
                  {t.state.current?.id !== "reife" && <p className="hint">Normalerweise nach der Wiederholungsphase. Du kannst trotzdem schon bestätigen.</p>}
                  <textarea name="message" rows={2} maxLength={600} placeholder="Nachricht an den Schüler (optional) – sonst Standardtext" />
                  <button className="btn btn-small" name="ready" value="1" type="submit">Prüfungsreife bestätigen + Schüler benachrichtigen</button>
                </form>
              )}
            </section>

            <section className="card">
              <h2>Unterlagen & Notiz</h2>
              <form action={saveDocsAction} className="akte-form">
                <input type="hidden" name="userId" value={id} />
                <div className="doc-checks">
                  {([["sehtestAt", "Sehtest"], ["ersteHilfeAt", "Erste-Hilfe-Kurs"], ["antragAt", "Antrag gestellt"], ["pruefauftragAt", "Prüfauftrag liegt vor"], ["theoryPassedAt", "Theorieprüfung bestanden"]] as const).map(([k, label]) => (
                    <label key={k} className="check"><input type="checkbox" name={k} defaultChecked={!!t.profile[k]} />
                      <span>{label}{t.profile[k] ? <span className="hint"> · {fmtDate(t.profile[k]!)}</span> : null}</span></label>
                  ))}
                </div>
                <textarea name="teacherNote" rows={3} maxLength={2000} defaultValue={t.profile.teacherNote} placeholder="Interne Notiz – sieht nur die Fahrschule" aria-label="Interne Notiz" />
                <button className="btn btn-secondary btn-small" type="submit">Speichern</button>
              </form>
            </section>
          </div>
        </div>
      )}

      {t && (
        <section className="card">
          <h2>Fahrten</h2>
          <AddRecordForm userId={id} today={dayKey(Date.now())}
            kinds={kindsFor(t.profile.licenseClass).map((k) => ({ value: k, label: KIND_LABEL[k] }))} />
          {t.records.length > 0 && (
            <ul className="list rec-list" style={{ marginTop: 16 }}>
              {t.records.map((r) => (
                <li key={r.id}>
                  <span><strong>{fmtDate(r.at)}</strong> · {r.minutes} Min {KIND_LABEL[r.kind]}{r.note && <span className="hint"> · {r.note}</span>}</span>
                  <span className="rec-actions">
                    <span className={`badge ${STATUS_CLS[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                    <form action={recordStatusAction} className="rec-actions">
                      <input type="hidden" name="userId" value={id} />
                      <input type="hidden" name="recordId" value={r.id} />
                      {r.status !== "done" && <button className="link-btn" name="status" value="done" type="submit">gefahren</button>}
                      {r.status !== "no_show" && <button className="link-btn" name="status" value="no_show" type="submit">nicht erschienen</button>}
                      {r.status !== "late" && <button className="link-btn" name="status" value="late" type="submit">zu spät</button>}
                      {r.source === "manual" && <button className="link-btn" name="do" value="delete" type="submit">löschen</button>}
                    </form>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </>
  );
}
