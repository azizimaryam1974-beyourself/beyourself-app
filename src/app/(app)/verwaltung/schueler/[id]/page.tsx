import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTeacher } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { getUser } from "@/lib/server/repo";
import { trainingWithBookings as trainingStateFor } from "@/lib/server/drive-booking";
import { examReadyAction, recordStatusAction, saveDocsAction, testfahrtAction } from "@/app/training-actions";
import { CLASS_LABEL, KIND_LABEL, TRAINING_CLASSES, type DriveKind } from "@/lib/training";
import { dayKey, fmtDate } from "@/lib/time";
import { ProgressView } from "@/components/training/ProgressView";
import { StudentTools } from "../../StudentTools";
import { CreditForm } from "./CreditForm";
import { creditBalance, CREDIT_LABEL, listCredit } from "@/lib/server/credit";
import { currentPackage } from "@/lib/server/repo";
import { bookableLanguages, getLanguage } from "@/lib/languages";
import { formatPrice } from "@/lib/language-package";
import { setPackageLanguageAction, setPackageStatusAction, teacherBookAction } from "@/app/actions";
import { AddRecordForm, TargetsForm } from "./Forms";
import { ExamInviteForm } from "./ExamForm";
import { EXAM_LABEL, EXAM_PLACES, EXAM_STATUS_LABEL, ensureGrundbetrag, examMissing, listExams, type ExamType } from "@/lib/server/exams";
import { cancelExamAction, examResultAction, grundbetragAction } from "@/app/exam-actions";
import { getOffer } from "@/lib/server/booking";
import { fmtDay, fmtTime } from "@/lib/time";
import { Avatar } from "@/components/ui/Avatar";
import { ClassSelect } from "@/components/ClassSelect";
import { availableStarts, firstBookableDay } from "@/lib/server/drive-booking";
import { grundbetragPaid } from "@/lib/server/training-repo";
import { getSettings } from "@/lib/server/booking";
import { driveHistory } from "@/lib/server/drive-history";
import { DriveHistoryList } from "@/components/training/DriveHistory";
import { DetailsForm } from "@/components/DetailsForm";
import { hasIdDocument, listDocs } from "@/lib/server/student-docs";
import { StudentDocs } from "@/components/docs/StudentDocs";
import { addressLine, getDetails, validateDetails } from "@/lib/server/user-details";

export const dynamic = "force-dynamic";
export const metadata = { title: "Schülerakte" };

const STATUS_LABEL = { done: "gefahren", planned: "gebucht", no_show: "nicht erschienen", late: "zu spät (ausgefallen)" } as const;
const STATUS_CLS = { done: "badge-ok", planned: "badge-warn", no_show: "badge-muted", late: "badge-muted" } as const;

function kindsFor(c: string): DriveKind[] {
  const base: DriveKind[] = c === "b197" ? ["automatik", "schalter"] : c === "b78" ? ["automatik"] : ["schalter"];
  const special: DriveKind[] = c === "umschreibung" ? [] : ["ueberland", "autobahn", "beleuchtung"];
  return [...base, ...special, "wiederholung", ...(c === "b197" ? (["testfahrt"] as DriveKind[]) : []), "warmstunde"];
}

export default async function StudentFile({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ fehler?: string }> }) {
  await requireTeacher();
  const { id } = await params;
  const { fehler } = await searchParams;
  const d = db();
  const user = getUser(d, id);
  if (!user || user.role !== "student") notFound();

  const t = trainingStateFor(d, id);
  const now = Date.now();
  const grundOpen = t ? ensureGrundbetrag(d, id, now) : null;
  const grundPaid = d.prepare(`SELECT paid_at, provider FROM bookings WHERE user_id = ? AND offer_id = 'fee-grundbetrag' AND status = 'paid' ORDER BY paid_at DESC`).get(id) as { paid_at: number; provider: string } | undefined;
  const exams = listExams(d, id);
  const price = (oid: string) => getOffer(d, oid)?.priceCents ?? 0;
  const priceText: Record<ExamType, string> = {
    theorie: `${formatPrice(price("fee-theorie"))} + TÜV ${formatPrice(price("fee-tuev-theorie"))}`,
    praxis: `Warmstunde ${formatPrice(price("drive-warmstunde"))} + ${formatPrice(price("fee-pruefung"))} + TÜV ${formatPrice(price("fee-tuev-praxis"))}`,
  };
  const canInvite = (type: ExamType) => !exams.some((e) => e.type === type && (e.status === "invited" || e.status === "confirmed" || e.status === "passed"));
  const det = getDetails(d, id);
  const detMissing = Object.keys(validateDetails({ birthday: det.birthday ?? "", street: det.street, zip: det.zip, city: det.city, phone: user.phone ?? "" })).length > 0;
  const age = det.birthday ? Math.floor((now - Date.parse(det.birthday)) / (365.25 * 86_400_000)) : null;
  const hist = driveHistory(d, id, now);
  // Was sieht der Schüler beim Buchen? (gleiche Regeln wie auf seiner Seite)
  const diag = (() => {
    const grund = !!t && (t.profile.grundWaived || grundbetragPaid(d, id));
    const first = t && !t.profile.blocked && grund ? t.state.bookable[0] ?? null : null;
    const mins = first ? (first.durations.includes(90) ? 90 : first.durations[0]) : 0;
    const days = first && mins ? availableStarts(d, first.kind as DriveKind, mins, firstBookableDay(d, now), 14, now, id) : [];
    const lead = getSettings(d).minLeadHours;
    return { grund, first, free: days.reduce((a, x) => a + x.starts.length, 0), days: days.filter((x) => x.starts.length).length,
      earliest: `${fmtDay(now + lead * 3_600_000)}, ${fmtTime(now + lead * 3_600_000)} Uhr (${lead} Std. Vorlauf)` };
  })();
  const docs = listDocs(d, id);
  const hasId = hasIdDocument(d, id);
  const docsNew = docs.filter((x) => x.status === "neu").length;
  const cur = currentPackage(d, id);
  const pkg = cur && cur.status !== "cancelled" ? cur : null;

  return (
    <>
      <Link className="back-link" href="/verwaltung">← Alle Schüler</Link>
      {fehler && <div className="alert alert-error" role="alert">{fehler}</div>}
      <div className="student-head">
        <div className="student-head-main">
          <Avatar id={user.id} name={user.name} photoAt={det.photoAt} size={64} />
          <div>
          <h1 style={{ marginBottom: 4 }}>{user.name}</h1>
          <p className="hint" style={{ marginTop: 0 }}>
            {user.phone && <><a href={`tel:${user.phone}`}>{user.phone}</a> · </>}<a href={`mailto:${user.email}`}>{user.email}</a>
            {" · "}seit {fmtDate(Date.parse(user.created_at))}
          </p>
          </div>
        </div>
        <ClassSelect userId={id} current={t?.profile.licenseClass ?? null} key={`cls-${t?.profile.licenseClass ?? "none"}`} />
      </div>

      <details className="card akte-details" open={detMissing}>
        <summary><h2 style={{ display: "inline" }}>Persönliche Angaben</h2> {detMissing && <span className="badge badge-warn">unvollständig</span>}</summary>
        <dl>
          <dt>Geburtstag</dt><dd>{det.birthday ? `${det.birthday.split("-").reverse().join(".")} (${age} Jahre)` : "–"}</dd>
          <dt>Adresse</dt><dd>{addressLine(det) || "–"}</dd>
          <dt>Telefon</dt><dd>{user.phone ?? "–"}</dd>
          <dt>E-Mail</dt><dd>{user.email}</dd>
        </dl>
        <DetailsForm userId={id} initial={{ birthday: det.birthday ?? "", street: det.street, zip: det.zip, city: det.city, phone: user.phone ?? "" }} />
      </details>

      <details className="card akte-docs" id="unterlagen" open={docsNew > 0 || !hasId}>
        <summary><h2 style={{ display: "inline" }}>Unterlagen</h2>{" "}
          {!hasId ? <span className="badge badge-error">Ausweis fehlt</span> : docsNew > 0 ? <span className="badge badge-warn">{docsNew} neu – bitte prüfen</span> : <span className="badge badge-ok">Ausweis da</span>}
        </summary>
        <p className="hint">Tippe auf eine Datei, um sie anzusehen. „Geprüft“ hakt Sehtest und Erste Hilfe auch unten bei „Unterlagen & Notiz“ ab. Du kannst auch selbst für den Schüler hochladen (z. B. wenn er Papiere mitbringt).</p>
        <StudentDocs docs={docs} teacher userId={id} umschreibung={t?.profile.licenseClass === "umschreibung"} />
      </details>

      {!t ? (
        <div className="card"><p>Für diesen Schüler ist noch keine Klasse festgelegt (Anmeldung vor dem 01.11.2026). Bitte oben rechts bei „Führerscheinklasse“ auswählen – wird sofort gespeichert.</p></div>
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

            <section className="card book-diag">
              <h2>Kann {user.name.split(" ")[0]} gerade buchen?</h2>
              <ul className="list">
                <li><span>Klasse</span><span className="badge badge-ok">{CLASS_LABEL[t.profile.licenseClass]}</span></li>
                <li><span>Grundbetrag</span>{diag.grund ? <span className="badge badge-ok">bezahlt/erlassen</span> : <span className="badge badge-error">offen – blockiert das Buchen</span>}</li>
                <li><span>Pausiert</span>{t.profile.blocked ? <span className="badge badge-error">ja – blockiert das Buchen</span> : <span className="badge badge-ok">nein</span>}</li>
                <li><span>Modus</span><span className="badge">{t.profile.manualApproval ? "nur Anfrage (deine Freigabe)" : "bucht direkt"}</span></li>
                <li><span>Jetzt dran</span><span>{diag.first ? `${KIND_LABEL[diag.first.kind as DriveKind]} (${diag.first.durations.join("/")} Min)` : "nichts – alles gebucht oder Ausbildung fertig"}</span></li>
                <li><span>Freie Zeiten (14 Tage)</span>{diag.first ? (diag.free > 0 ? <span className="badge badge-ok">{diag.free} Startzeiten an {diag.days} Tagen</span> : <span className="badge badge-error">keine – Arbeitszeiten prüfen</span>) : <span>–</span>}</li>
                <li><span>Frühestens buchbar</span><span>{diag.earliest}</span></li>
                <li><span>Ausweis</span>{hasId ? <span className="badge badge-ok">hochgeladen</span> : <span className="badge badge-warn">fehlt (nur Hinweis)</span>}</li>
              </ul>
            </section>

            <section className="card">
              <h2>Stunden & Regeln</h2>
              <TargetsForm key={`tg-${t.profile.practiceTarget}-${t.profile.repeatTarget}-${t.profile.maxPerWeek}-${t.profile.manualApproval}-${t.profile.blocked}`} userId={id} isB197={t.profile.licenseClass === "b197"} practiceTarget={t.profile.practiceTarget}
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
              <form action={saveDocsAction} className="akte-form" key={`docs-${[t.profile.sehtestAt, t.profile.ersteHilfeAt, t.profile.antragAt, t.profile.pruefauftragAt, t.profile.theoryPassedAt, t.profile.teacherNote].join("|")}`}>
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
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h2 style={{ margin: 0 }}>Grundbetrag</h2>
            {t.profile.grundWaived ? <span className="badge badge-ok">anders geregelt</span>
              : grundPaid ? <span className="badge badge-ok">bezahlt am {fmtDate(grundPaid.paid_at)}{grundPaid.provider === "bar" ? " (bar/EC)" : ""}</span>
              : <span className="badge badge-warn">offen</span>}
          </div>
          {!t.profile.grundWaived && !grundPaid && grundOpen && (
            <div className="row" style={{ marginTop: 12 }}>
              <span className="hint">{formatPrice(grundOpen.priceCents)} – Fahrstunden sind erst nach Zahlung buchbar.</span>
              <form action={grundbetragAction}><input type="hidden" name="userId" value={id} /><button className="btn btn-small" name="do" value="cash" type="submit">Bar/EC bezahlt</button></form>
              <form action={grundbetragAction}><input type="hidden" name="userId" value={id} /><button className="btn btn-secondary btn-small" name="do" value="waive" type="submit">Schon bezahlt (vor der App) / erlassen</button></form>
            </div>
          )}
          {t.profile.grundWaived && (
            <form action={grundbetragAction} style={{ marginTop: 8 }}><input type="hidden" name="userId" value={id} />
              <button className="link-btn" name="do" value="unwaive" type="submit">zurücknehmen (Grundbetrag wieder offen)</button></form>
          )}
        </section>
      )}

      {t && (
        <section className="card" id="pruefungen">
          <h2>Prüfungen</h2>
          {exams.length > 0 && (
            <ul className="list" style={{ marginBottom: 16 }}>
              {exams.map((e) => (
                <li key={e.id}>
                  <div>
                    <strong>{EXAM_LABEL[e.type]}</strong> · {fmtDay(e.startsAt)} {fmtTime(e.startsAt)} Uhr · {e.place}
                    {e.warmAt && <span className="hint"> · Warmstunde {fmtTime(e.warmAt)}</span>}
                  </div>
                  <span className="rec-actions">
                    <span className={`badge ${e.status === "passed" || e.status === "confirmed" ? "badge-ok" : e.status === "invited" ? "badge-warn" : "badge-muted"}`}>{EXAM_STATUS_LABEL[e.status]}</span>
                    {e.status === "confirmed" && now >= e.startsAt && (
                      <form action={examResultAction} className="rec-actions">
                        <input type="hidden" name="examId" value={e.id} />
                        <button className="btn btn-small" name="result" value="passed" type="submit">Bestanden</button>
                        <button className="btn btn-secondary btn-small" name="result" value="failed" type="submit">Nicht bestanden</button>
                        <button className="link-btn" name="result" value="no_show" type="submit">nicht erschienen</button>
                      </form>
                    )}
                    {(e.status === "invited" || (e.status === "confirmed" && now < e.startsAt)) && (
                      <form action={cancelExamAction}>
                        <input type="hidden" name="examId" value={e.id} />
                        <button className="link-btn" type="submit">{e.status === "confirmed" ? "absagen / verschieben (Betrag → Guthaben)" : "Einladung zurückziehen"}</button>
                      </form>
                    )}
                    {(e.status === "passed" || e.status === "failed" || e.status === "no_show") && (
                      <form action={examResultAction} className="rec-actions">
                        <input type="hidden" name="examId" value={e.id} />
                        {e.status !== "passed" && <button className="link-btn" name="result" value="passed" type="submit">→ bestanden</button>}
                        {e.status !== "failed" && <button className="link-btn" name="result" value="failed" type="submit">→ nicht bestanden</button>}
                      </form>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="exam-forms">
            {(["theorie", "praxis"] as const).map((type) => {
              const missing = examMissing(d, id, type);
              const done = missing.some((m) => m.startsWith("("));
              if (done || !canInvite(type)) return null;
              return (
                <details key={type} className="exam-invite">
                  <summary className="btn btn-secondary btn-small">Einladung: {EXAM_LABEL[type]} …</summary>
                  <ExamInviteForm userId={id} type={type} missing={missing} today={dayKey(now)} places={[...EXAM_PLACES]} priceText={priceText[type]} />
                </details>
              );
            })}
          </div>
          <p className="hint">Den Termin trägst du ein, sobald der TÜV ihn bestätigt hat. Der Schüler bekommt eine Nachricht und bestätigt verbindlich durch Bezahlen.
            Fahrschule und TÜV stehen getrennt auf der Zahlung. Verschiebst du, geht Bezahltes als Guthaben zurück und wird beim neuen Termin verrechnet.</p>
        </section>
      )}

      {t && (
        <section className="card">
          <h2 id="fahrten">Fahrt-Historie</h2>
          <AddRecordForm userId={id} today={dayKey(Date.now())}
            kinds={kindsFor(t.profile.licenseClass).map((k) => ({ value: k, label: KIND_LABEL[k] }))} />
          <div style={{ marginTop: 16 }}>
            <DriveHistoryList past={hist.past} upcoming={hist.upcoming} actions={(e) => e.recordId && (
              <form action={recordStatusAction} className="rec-actions">
                <input type="hidden" name="userId" value={id} />
                <input type="hidden" name="recordId" value={e.recordId} />
                {e.status !== "done" && <button className="link-btn" name="status" value="done" type="submit">gefahren</button>}
                {e.status !== "no_show" && <button className="link-btn" name="status" value="no_show" type="submit">nicht erschienen</button>}
                {e.status !== "late" && <button className="link-btn" name="status" value="late" type="submit">zu spät</button>}
                {e.source === "manual" && <button className="link-btn" name="do" value="delete" type="submit">löschen</button>}
              </form>
            )} />
          </div>
        </section>
      )}

      <section className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2 style={{ margin: 0 }}>Guthaben</h2>
          <span className="credit-big">{formatPrice(creditBalance(d, id))}</span>
        </div>
        <p className="hint">Entsteht bei Absagen und wird bei der nächsten Buchung automatisch verrechnet. Auszahlen nur, wenn der Schüler die Ausbildung beendet oder es verlangt.</p>
        {listCredit(d, id, 15).length > 0 && (
          <ul className="list ledger">
            {listCredit(d, id, 15).map((e) => (
              <li key={e.id}>
                <span>{CREDIT_LABEL[e.reason]}{e.note ? ` · ${e.note}` : ""} <span className="hint">· {fmtDate(e.createdAt)}</span></span>
                <strong className={e.amountCents < 0 ? "neg" : "pos"}>{e.amountCents > 0 ? "+" : "−"}{formatPrice(Math.abs(e.amountCents))}</strong>
              </li>
            ))}
          </ul>
        )}
        <CreditForm userId={id} />
      </section>

      <section className="card">
        <h2>Sprachpaket</h2>
        {pkg ? (
          <div className="akte-form">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span><strong>{getLanguage(pkg.language)?.labelDe}</strong> · {formatPrice(pkg.priceCents)}</span>
              <span className={`badge ${pkg.status === "paid" ? "badge-ok" : "badge-warn"}`}>{pkg.status === "paid" ? "bezahlt" : "noch nicht bezahlt"}</span>
            </div>
            <div className="row">
              {pkg.status === "booked" && (
                <form action={setPackageStatusAction}><input type="hidden" name="packageId" value={pkg.id} /><input type="hidden" name="status" value="paid" />
                  <button className="btn btn-small" type="submit">Bar/EC bezahlt</button></form>
              )}
              <form action={setPackageLanguageAction} className="row">
                <input type="hidden" name="packageId" value={pkg.id} />
                <select name="language" defaultValue={pkg.language} aria-label="Sprache ändern" style={{ width: "auto" }}>
                  {bookableLanguages().map((l) => <option key={l.code} value={l.code}>{l.labelDe}</option>)}
                </select>
                <button className="btn btn-secondary btn-small" type="submit">Sprache ändern</button>
              </form>
              <form action={setPackageStatusAction}><input type="hidden" name="packageId" value={pkg.id} /><input type="hidden" name="status" value="cancelled" />
                <button className="link-btn" type="submit">Paket stornieren</button></form>
            </div>
          </div>
        ) : (
          <form action={teacherBookAction} className="row">
            <input type="hidden" name="userId" value={id} />
            <span className="hint">Kein Sprachpaket.</span>
            <select name="language" aria-label="Sprache" style={{ width: "auto" }}>
              {bookableLanguages().map((l) => <option key={l.code} value={l.code}>{l.labelDe}</option>)}
            </select>
            <button className="btn btn-secondary btn-small" type="submit">Für Schüler buchen</button>
          </form>
        )}
      </section>

      <section className="card">
        <h2>Konto</h2>
        <StudentTools userId={id} name={user.name} />
      </section>
    </>
  );
}
