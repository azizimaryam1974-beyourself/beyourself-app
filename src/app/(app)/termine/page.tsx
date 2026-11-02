import { getBankDetails } from "@/lib/server/finance";
import { stripeTestMode } from "@/lib/server/payments/stripe";
import { TOPUP_MAX_CENTS, TOPUP_MIN_CENTS } from "@/lib/server/topup";
import { driveHistory } from "@/lib/server/drive-history";
import { DriveHistoryList } from "@/components/training/DriveHistory";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { currentPackage } from "@/lib/server/repo";
import { getSettings, listBookingsForUser, listNotifications, listOffers, type Booking } from "@/lib/server/booking";
import { availableStarts, drivesInWeek, firstBookableDay, MEETING_POINTS, priceConfig, trainingWithBookings } from "@/lib/server/drive-booking";
import { availableProviders, runBookingJobs, type Provider } from "@/lib/server/payments/service";
import { addWaitlistAction, cancelMyBookingAction, markReadAction, orderProductAction, removeWaitlistAction } from "@/app/booking-actions";
import { cancelInfo } from "@/lib/server/cancel";
import { creditBalance, CREDIT_LABEL, listCredit } from "@/lib/server/credit";
import { listWaitlist } from "@/lib/server/waitlist";
import { closedReason } from "@/lib/calendar";
import { bookDriveAction } from "@/app/calendar-actions";
import { formatPrice } from "@/lib/language-package";
import { addDays, dayKey, fmtDate, fmtDay, fmtDayShort, fmtSlot, fmtTime } from "@/lib/time";
import { CLASS_LABEL, KIND_LABEL, priceCents, type DriveKind } from "@/lib/training";
import { Countdown } from "@/components/booking/Countdown";
import { Empty, Panel } from "@/components/ui/Panel";
import { ensureGrundbetrag, EXAM_LABEL, EXAM_STATUS_LABEL, getExam, listExams } from "@/lib/server/exams";
import { grundbetragPaid } from "@/lib/server/training-repo";
import { declineExamAction } from "@/app/exam-actions";

export const metadata = { title: "Termine & Buchen" };
export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; cls: string }> = {
  requested: { label: "Angefragt – wartet auf Freigabe", cls: "badge-warn" },
  awaiting_payment: { label: "Reserviert – bitte bezahlen", cls: "badge-warn" },
  paid: { label: "Gebucht", cls: "badge-ok" },
  declined: { label: "Abgelehnt", cls: "badge-muted" },
  expired: { label: "Frist abgelaufen", cls: "badge-muted" },
  cancelled: { label: "Abgesagt", cls: "badge-muted" },
  withdrawn: { label: "Zurückgezogen", cls: "badge-muted" },
};
const PROVIDER_BTN: Record<Provider, string> = { stripe: "Jetzt zahlen", paypal: "Mit PayPal zahlen", test: "Test-Zahlung (Testmodus)", guthaben: "Mit Guthaben bezahlen" };
const NOTICE: Record<string, { cls: string; text: string }> = {
  bezahlt: { cls: "alert-ok", text: "Danke! Deine Zahlung ist angekommen – die Fahrt ist fest gebucht." },
  gebucht: { cls: "alert-ok", text: "Die Zeit ist für dich reserviert. Bitte bezahle jetzt, dann ist sie fest." },
  warteliste: { cls: "alert-ok", text: "Du stehst auf der Warteliste. Wird etwas frei, bekommst du eine Nachricht." },
  angefragt: { cls: "alert-ok", text: "Deine Anfrage ist bei der Fahrschule. Die Zeit ist so lange für dich reserviert." },
  abgesagt: { cls: "alert-ok", text: "Erledigt." },
  abgebrochen: { cls: "alert-info", text: "Die Zahlung wurde abgebrochen. Es wurde nichts abgebucht. Du kannst es innerhalb der Frist erneut versuchen." },
  pruefen: { cls: "alert-info", text: "Wir warten noch auf die Bestätigung des Zahlungsanbieters. Lade die Seite in einer Minute neu." },
  problem: { cls: "alert-error", text: "Bei der Zahlung gab es ein Problem. Schau in deine Nachrichten – die Fahrschule ist informiert." },
};

function PayBox({ b, providers, credit, now }: { b: Booking; providers: Provider[]; credit: number; now: number }) {
  const use = Math.min(credit + b.creditCents, b.priceCents);
  const rest = b.priceCents - use;
  const exam = b.examId ? getExam(db(), b.examId) : undefined;
  const longDeadline = (b.payDeadline ?? 0) - now > 2 * 3_600_000;
  const isGrund = b.offerId === "fee-grundbetrag";
  const consent = exam
    ? <>Ich bestätige den Prüfungstermin <strong>verbindlich</strong> und akzeptiere die <Link href="/buchungsbedingungen" target="_blank">Buchungsbedingungen</Link>. Wer nicht erscheint, verliert die Gebühren.</>
    : <>Ich akzeptiere die <Link href="/buchungsbedingungen" target="_blank">Buchungsbedingungen</Link> und verlange, dass die Fahrschule
      vor Ablauf der Widerrufsfrist mit der Leistung beginnt. Mir ist bekannt, dass mein Widerrufsrecht mit vollständiger Erbringung der Leistung erlischt.</>;
  return (
    <div className="pay-box">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <strong>{exam ? `Einladung: ${EXAM_LABEL[exam.type]}` : b.title}</strong> · {formatPrice(b.priceCents)}
          {exam && <div>{fmtDay(exam.startsAt)} · <strong>{fmtTime(exam.startsAt)} Uhr</strong> · {exam.place}</div>}
          {exam?.warmAt && <div className="hint">Warmstunde ab {fmtTime(exam.warmAt)} Uhr · Treffpunkt: {b.meetingPoint}</div>}
          {!exam && b.startsAt && b.endsAt && <div>{fmtSlot(b.startsAt, b.endsAt)}</div>}
          {!exam && b.meetingPoint && <div className="hint">Treffpunkt: {b.meetingPoint}</div>}
          {isGrund && <div className="hint">Einmalig, mit der Anmeldung fällig. Danach kannst du Fahrstunden buchen.</div>}
          {b.adminMessage && <blockquote className="note">{b.adminMessage}</blockquote>}
        </div>
        <div className="pay-timer">
          {longDeadline
            ? <span className="hint">Bezahlen bis <strong>{fmtDayShort(b.payDeadline!)}, {fmtTime(b.payDeadline!)} Uhr</strong></span>
            : <><span className="hint">Bezahlen bis {fmtTime(b.payDeadline!)} Uhr</span><Countdown until={b.payDeadline!} /></>}
        </div>
      </div>
      {b.lines.length > 1 && (
        <ul className="pay-lines">
          {b.lines.map((l, i) => <li key={i}><span>{l.label}{l.part === "tuev" && <span className="badge badge-muted" style={{ marginLeft: 6 }}>TÜV</span>}</span><span>{formatPrice(l.cents)}</span></li>)}
        </ul>
      )}
      {use > 0 && (
        <div className="credit-use">Dein Guthaben wird verrechnet: <strong>−{formatPrice(use)}</strong>{rest > 0 ? <> · noch zu zahlen: <strong>{formatPrice(rest)}</strong></> : <> · <strong>nichts mehr zu zahlen</strong></>}</div>
      )}
      {rest <= 0 ? (
        <form action="/api/zahlung/start" method="post">
          <input type="hidden" name="b" value={b.id} />
          <label className="check">
            <input type="checkbox" name="terms" required />
            <span>{consent}</span>
          </label>
          <button className="btn btn-gold" type="submit" name="provider" value="guthaben">Mit Guthaben bezahlen</button>
        </form>
      ) : providers.length ? (
        <form action="/api/zahlung/start" method="post">
          <input type="hidden" name="b" value={b.id} />
          <label className="check">
            <input type="checkbox" name="terms" required />
            <span>{consent}</span>
          </label>
          {providers.includes("stripe") && stripeTestMode() && (
            <p className="test-hint">Testmodus – es fließt kein echtes Geld. Testkarte: <strong>4242 4242 4242 4242</strong>, Ablaufdatum irgendwann in der Zukunft, Prüfnummer beliebig (z. B. 123).</p>
          )}
          <div className="row">
            {providers.map((p) => (
              <button key={p} className={`btn ${p === "stripe" ? "btn-gold" : p === "paypal" ? "btn-paypal" : "btn-secondary"}`} type="submit" name="provider" value={p}>{PROVIDER_BTN[p]}</button>
            ))}
            {providers.includes("stripe") && <span className="hint pay-methods">Karte · Apple Pay · Google Pay · Klarna</span>}
          </div>
        </form>
      ) : <p className="hint">Online-Zahlung ist noch nicht eingerichtet. Bitte bezahle bar oder mit EC-Karte in der Fahrschule.</p>}
      {exam ? (
        <details className="late-cancel">
          <summary className="link-btn">Ich kann an diesem Termin nicht …</summary>
          <form action={declineExamAction} className="late-box">
            <input type="hidden" name="examId" value={exam.id} />
            <input name="reason" maxLength={300} placeholder="Grund (optional), z. B. Schule, Arbeit, krank" aria-label="Grund" />
            <button className="btn btn-secondary btn-small" type="submit">Einladung ablehnen – Fahrschule informieren</button>
          </form>
        </details>
      ) : !isGrund && (
        <form action={cancelMyBookingAction}>
          <input type="hidden" name="bookingId" value={b.id} />
          <button className="link-btn" type="submit">Doch nicht – Zeit wieder freigeben</button>
        </form>
      )}
    </div>
  );
}

export default async function BookingPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  if (user.role === "teacher") redirect("/verwaltung/kalender");
  await runBookingJobs();
  const sp = await searchParams;
  const d = db();
  const now = Date.now();
  const settings = getSettings(d);
  ensureGrundbetrag(d, user.id, now);
  const grundOk = grundbetragPaid(d, user.id);
  const exams = listExams(d, user.id).slice(0, 6);
  const training = trainingWithBookings(d, user.id, now);
  const mine = listBookingsForUser(d, user.id);
  const toPay = mine.filter((b) => b.status === "awaiting_payment");
  const active = mine.filter((b) => b.status === "requested" || (b.status === "paid" && (b.startsAt ?? 0) > now));
  const history = mine.filter((b) => !active.includes(b) && !toPay.includes(b)).slice(0, 15);
  const notes = listNotifications(d, user.id, 10);
  const unread = notes.filter((n) => !n.readAt).length;
  const providers = availableProviders();
  const pkg = currentPackage(d, user.id);
  const products = listOffers(d, { bookableOnly: true }).filter((o) => o.kind === "product" || (o.kind === "language" && pkg?.status === "booked"));
  const cfg = priceConfig(d);
  const credit = creditBalance(d, user.id);
  const bank = getBankDetails(d);
  const hist = driveHistory(d, user.id, now);
  const ledger = listCredit(d, user.id, 20);
  const waits = listWaitlist(d, user.id, dayKey(now));
  const waitDays = Array.from({ length: 21 }, (_, i) => addDays(dayKey(now), i + 1)).filter((x) => !closedReason(x));
  const noticeKey = sp.bezahlt ? "bezahlt" : sp.gebucht ? "gebucht" : sp.angefragt ? "angefragt" : sp.abgesagt ? "abgesagt" : sp.warteliste ? "warteliste" : sp.zahlung;

  // Auswahl: Art (k), Länge (d), Startzeit (t)
  const options = training && !training.profile.blocked && grundOk ? training.state.bookable : [];
  const opt = options.find((o) => o.kind === sp.k) ?? null;
  const minutes = opt && opt.durations.includes(Number(sp.d)) ? Number(sp.d) : null;
  const days = opt && minutes ? availableStarts(d, opt.kind as DriveKind, minutes, firstBookableDay(d, now), 14, now, user.id) : [];
  const chosen = minutes && sp.t && days.some((x) => x.starts.includes(Number(sp.t))) ? Number(sp.t) : null;
  const withTimes = days.filter((x) => x.starts.length);
  const selDay = days.find((x) => x.day === sp.tag && x.starts.length) ?? (chosen ? days.find((x) => x.starts.includes(chosen)) : null) ?? withTimes[0] ?? null;
  const weekCount = chosen ? drivesInWeek(d, user.id, chosen) : 0;
  const link = (q: Record<string, string | number>) => `/termine?${new URLSearchParams(Object.entries(q).map(([k, v]) => [k, String(v)])).toString()}#buchen`;

  return (
    <>
      <h1>Fahrstunden</h1>
      {noticeKey && NOTICE[noticeKey] && <div className={`alert ${NOTICE[noticeKey].cls}`} role="status">{NOTICE[noticeKey].text}</div>}
      {sp.fehler && toPay.length === 0 && <div className="alert alert-error" role="alert">{sp.fehler}</div>}

      {toPay.length > 0 && (
        <Panel id="offen" icon="pay" title="Bitte bezahlen" className="panel-accent" help={<>
          <p>Hier steht alles, was du noch bezahlen musst. Erst mit der Zahlung ist ein Termin fest für dich gebucht.</p>
          <p>Fahrstunden: Du hast {settings.payWindowMin} Minuten Zeit, danach wird die Zeit wieder für andere frei. Grundbetrag und Prüfungen haben längere Fristen – das Datum steht jeweils daneben.</p>
          <p>Vorhandenes Guthaben wird automatisch zuerst verrechnet. Bezahlen kannst du online oder bar/EC in der Fahrschule.</p>
        </>}>
          {sp.fehler && <div className="alert alert-error" role="alert">{sp.fehler}</div>}
          {toPay.map((b) => <PayBox key={b.id} b={b} providers={providers} credit={credit} now={now} />)}
        </Panel>
      )}

      {exams.length > 0 && (
        <Panel id="pruefungen" icon="flag" title="Deine Prüfungen" help={<>
          <p>Prüfungstermine legt die Fahrschule fest, sobald der TÜV sie bestätigt hat. Du bekommst eine Einladung und bestätigst verbindlich durch Bezahlen.</p>
          <p>Bitte zur Prüfung immer Personalausweis oder Reisepass mitbringen. Wer nicht erscheint, verliert die Gebühren.</p>
        </>}>
          <ul className="list">
            {exams.map((e) => (
              <li key={e.id}>
                <div>
                  <strong>{EXAM_LABEL[e.type]}</strong>
                  <div>{fmtDay(e.startsAt)} · {fmtTime(e.startsAt)} Uhr · {e.place}</div>
                  {e.warmAt && e.status === "confirmed" && <div className="hint">Warmstunde ab {fmtTime(e.warmAt)} Uhr – bitte Ausweis mitbringen.</div>}
                </div>
                <span className={`badge ${e.status === "passed" || e.status === "confirmed" ? "badge-ok" : e.status === "invited" ? "badge-warn" : "badge-muted"}`}>{EXAM_STATUS_LABEL[e.status]}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel id="buchen" icon="car" title="Fahrt buchen" help={<>
        <p>Du siehst nur die Fahrten, die für deinen Ausbildungsstand gerade dran sind – z. B. zuerst Übungsfahrten, später Sonderfahrten.</p>
        <p>So geht&apos;s: 1. Art und Länge wählen (60, 75 oder 90 Minuten) · 2. Tag antippen · 3. Uhrzeit antippen · 4. reservieren und bezahlen.</p>
        <p>Der Preis wird genau anteilig berechnet. Beleuchtungsfahrten gibt es nur, wenn es draußen dunkel ist.</p>
      </>}>
        {!training ? (
          <Empty icon="wait" text="Wartet auf deine Klasse – die Fahrschule legt sie fest." action={<Link className="btn btn-secondary btn-small" href="/nachrichten">Fahrschule fragen</Link>} />
        ) : training.profile.blocked ? (
          <Empty icon="chat" text="Buchen ist gerade pausiert." action={<Link className="btn btn-secondary btn-small" href="/nachrichten">Fahrschule schreiben</Link>} />
        ) : !grundOk ? (
          <Empty icon="pay" text="Erst den Grundbetrag bezahlen – dann geht's los." action={<a className="btn btn-gold btn-small" href="#offen">Zum Bezahlen</a>} />
        ) : (
          <>
            <p className="book-next"><span className="hint">{CLASS_LABEL[training.profile.licenseClass]} · </span>{training.state.next}
              {" "}<Link href="/konto" className="hint">Fortschritt ansehen</Link></p>
            {options.length === 0 ? (
              <Empty icon="check" text="Gerade ist alles gebucht – jetzt fahren!" />
            ) : (
              <div className="pick-grid">
                {options.map((o) => (
                  <div key={o.kind} className={`pick ${opt?.kind === o.kind ? "on" : ""}`}>
                    <div className="pick-title">{KIND_LABEL[o.kind]}</div>
                    {o.remaining !== null && <div className="hint">noch {o.remaining} Min offen</div>}
                    <div className="chips">
                      {o.durations.map((m) => (
                        <Link key={m} className={`chip ${opt?.kind === o.kind && minutes === m ? "on" : ""}`} href={link({ k: o.kind, d: m })}>
                          {m} Min · {formatPrice(priceCents(o.kind, m, cfg))}
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {opt && minutes && (
              <div className="times">
                <h3>Freie Zeiten für {KIND_LABEL[opt.kind]} ({minutes} Min)</h3>
                {opt.kind === "beleuchtung" && <p className="hint">Beleuchtungsfahrten gibt es erst, wenn es dunkel ist – die Zeiten passen sich jeden Tag an.</p>}
                {chosen && (
                  <form action={bookDriveAction} className="confirm-box">
                    <input type="hidden" name="kind" value={opt.kind} />
                    <input type="hidden" name="minutes" value={minutes} />
                    <input type="hidden" name="start" value={chosen} />
                    <div className="confirm-what">
                      <strong>{fmtDay(chosen)}, {fmtTime(chosen)}–{fmtTime(chosen + minutes * 60_000)} Uhr</strong>
                      <div>{KIND_LABEL[opt.kind]} · {minutes} Min · <strong>{formatPrice(priceCents(opt.kind, minutes, cfg))}</strong></div>
                      <div className="hint">Diese Woche: {weekCount} von {training.profile.maxPerWeek} Fahrten gebucht</div>
                    </div>
                    <div className="field" style={{ margin: 0 }}>
                      <label htmlFor="meet">Treffpunkt</label>
                      <select id="meet" name="meeting">{MEETING_POINTS.map((m) => <option key={m} value={m}>{m}</option>)}</select>
                    </div>
                    <input type="text" name="note" maxLength={300} placeholder="Nachricht an die Fahrschule (optional), z. B. Abholadresse" aria-label="Nachricht" />
                    {chosen - now < settings.freeCancelHours * 3_600_000 && (
                      <div className="alert alert-info" style={{ margin: 0 }}><strong>Last-Minute-Termin:</strong> Weniger als {settings.freeCancelHours} Stunden vorher gebucht – dieser Termin kann nicht mehr abgesagt werden.</div>
                    )}
                    <p className="hint" style={{ margin: 0 }}>
                      {training.profile.manualApproval ? "Die Fahrschule bestätigt deine Anfrage; die Zeit ist so lange für dich reserviert."
                        : `Die Zeit wird sofort für dich reserviert. Danach hast du ${settings.payWindowMin} Minuten zum Bezahlen.`}
                    </p>
                    <div className="row">
                      <button className="btn btn-gold" type="submit">{training.profile.manualApproval ? "Anfrage senden" : "Verbindlich reservieren"}</button>
                      <Link className="btn btn-secondary btn-small" href={link({ k: opt.kind, d: minutes })}>Andere Zeit</Link>
                    </div>
                  </form>
                )}
                {!withTimes.length ? (
                  <p className="hint">In den nächsten 14 Tagen ist leider nichts frei. Schau bald wieder vorbei.</p>
                ) : (
                  <>
                    <div className="day-picker" role="group" aria-label="Tag wählen">
                      {days.map((x) => x.closed ? null : (
                        <Link key={x.day} aria-disabled={!x.starts.length}
                          className={`day-chip ${selDay?.day === x.day ? "on" : ""} ${x.starts.length ? "" : "none"}`}
                          href={x.starts.length ? link({ k: opt.kind, d: minutes, tag: x.day }) : "#buchen"}>
                          <span className="dc-wd">{fmtDayShort(new Date(`${x.day}T12:00:00Z`).getTime()).split(",")[0]}</span>
                          <span className="dc-d">{x.day.slice(8)}.{x.day.slice(5, 7)}.</span>
                          <span className="dc-n">{x.starts.length ? `${x.starts.length} frei` : "voll"}</span>
                        </Link>
                      ))}
                    </div>
                    {selDay && (
                      <div className="day-times">
                        <div className="day-name">{fmtDay(new Date(`${selDay.day}T12:00:00Z`).getTime())}</div>
                        <div className="chips">
                          {selDay.starts.map((st) => (
                            <Link key={st} className={`chip time ${chosen === st ? "on" : ""}`} href={link({ k: opt.kind, d: minutes, tag: selDay.day, t: st })}>{fmtTime(st)}</Link>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </>
        )}
      </Panel>

      <Panel id="meine" icon="cal" title="Meine Termine" help={<>
        <p>Kostenlos absagen kannst du bis {settings.freeCancelHours} Stunden vorher, spätestens um {settings.cancelCutoffHour} Uhr am Vortag. Der Betrag kommt als Guthaben auf dein Konto.</p>
        <p>Danach werden {settings.lateChargePct} % berechnet. Übernimmt jemand anderes den Termin, bekommst du auch das zurück.</p>
        <p>Wer nicht erscheint oder mehr als 15 Minuten zu spät kommt, zahlt {settings.noShowChargePct} %. Termine, die weniger als 24 Stunden vorher gebucht wurden, können nicht abgesagt werden.</p>
      </>}>
        {active.length === 0 ? <Empty icon="cal" text="Noch keine Termine." action={grundOk && options.length ? <a className="btn btn-secondary btn-small" href="#buchen">Fahrt buchen</a> : undefined} /> : (
          <ul className="list">
            {active.map((b) => {
              const ci = b.kind && !b.examId ? cancelInfo(b, settings, now) : null;
              return (
                <li key={b.id}>
                  <div>
                    <strong>{b.title}</strong>
                    <div>{b.startsAt && b.endsAt ? fmtSlot(b.startsAt, b.endsAt) : formatPrice(b.priceCents)}</div>
                    {b.meetingPoint && <div className="hint">Treffpunkt: {b.meetingPoint}</div>}
                    {b.adminMessage && b.status === "paid" && <blockquote className="note">{b.adminMessage}</blockquote>}
                    {ci?.mode === "free" && <div className="hint">Kostenlos absagen bis {fmtDayShort(ci.deadline!)} {fmtTime(ci.deadline!)} Uhr</div>}
                    {ci?.mode === "lastminute" && <div className="hint">Last-Minute-Termin – keine Absage möglich</div>}
                  </div>
                  <div className="row">
                    <span className={`badge ${STATUS[b.status].cls}`}>{STATUS[b.status].label}</span>
                    {(ci?.mode === "withdraw" || ci?.mode === "free" || (!b.kind && !b.examId && b.status === "requested")) && (
                      <form action={cancelMyBookingAction}>
                        <input type="hidden" name="bookingId" value={b.id} />
                        <button className="btn btn-secondary btn-small" type="submit">{ci?.mode === "free" ? `Absagen (${formatPrice(b.priceCents)} Guthaben)` : "Anfrage zurückziehen"}</button>
                      </form>
                    )}
                    {ci?.mode === "late" && (
                      <details className="late-cancel">
                        <summary className="btn btn-secondary btn-small">Kurzfristig absagen …</summary>
                        <form action={cancelMyBookingAction} className="late-box">
                          <input type="hidden" name="bookingId" value={b.id} />
                          <p>Die kostenlose Frist ist vorbei. <strong>{formatPrice(ci.chargeCents)}</strong> ({settings.lateChargePct} %) werden berechnet,
                            <strong> {formatPrice(ci.creditCents)}</strong> bekommst du als Guthaben. Übernimmt jemand den Termin, bekommst du auch den Rest zurück.</p>
                          <button className="btn btn-danger btn-small" type="submit">Trotzdem absagen</button>
                        </form>
                      </details>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Panel id="warteliste" icon="wait" title="Warteliste" help={<>
        <p>Nichts Passendes frei? Trag dich für einen Tag und einen Zeitraum ein.</p>
        <p>Wird dort etwas frei, bekommst du als Erste/r eine Nachricht und hast 30 Minuten, in denen nur du buchen kannst. Danach sehen es alle.</p>
        <p>Ein Eintrag pro Woche. Nachts (22–7 Uhr) kommen keine Nachrichten.</p>
      </>}>
        {waits.length === 0 && !(training && !training.profile.blocked && grundOk) && <Empty icon="wait" text="Noch nicht verfügbar." />}
        {waits.length > 0 && (
          <ul className="list">
            {waits.map((w) => (
              <li key={w.id}>
                <span><strong>{fmtDay(new Date(`${w.day}T12:00:00Z`).getTime())}</strong> · {String(Math.floor(w.fromMin / 60)).padStart(2, "0")}:{String(w.fromMin % 60).padStart(2, "0")}–{String(Math.floor(w.toMin / 60)).padStart(2, "0")}:{String(w.toMin % 60).padStart(2, "0")} Uhr</span>
                <form action={removeWaitlistAction}><input type="hidden" name="id" value={w.id} /><button className="link-btn" type="submit">austragen</button></form>
              </li>
            ))}
          </ul>
        )}
        {training && !training.profile.blocked && grundOk && (
          <form action={addWaitlistAction} className="wait-form">
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="wday">Tag</label>
              <select id="wday" name="day">{waitDays.map((x) => <option key={x} value={x}>{fmtDayShort(new Date(`${x}T12:00:00Z`).getTime())}</option>)}</select>
            </div>
            <div className="field" style={{ margin: 0 }}><label htmlFor="wf">von</label><input id="wf" type="time" name="from" step={900} defaultValue="09:00" /></div>
            <div className="field" style={{ margin: 0 }}><label htmlFor="wt">bis</label><input id="wt" type="time" name="to" step={900} defaultValue="21:00" /></div>
            <button className="btn btn-secondary btn-small" type="submit">Eintragen</button>
          </form>
        )}
      </Panel>

      <Panel id="fahrten" icon="history" title="Meine Fahrten" help={<>
        <p>Hier siehst du jede Fahrt: wann, wie lange, welche Art und mit wem. Oben stehen deine kommenden Fahrten, darunter alle bisherigen.</p>
        <p>Stimmt etwas nicht? Schreib der Fahrschule im Chat.</p>
      </>}>
        <DriveHistoryList past={hist.past} upcoming={hist.upcoming} />
      </Panel>

      <Panel id="guthaben" icon="coin" title="Guthaben" right={<span className="credit-big">{formatPrice(credit)}</span>} help={<>
        <p>Sagst du rechtzeitig ab, bekommst du das Geld als Guthaben zurück.</p>
        <p>Es wird bei deiner nächsten Buchung automatisch verrechnet – du musst nichts tun. Am Ende der Ausbildung kann es auf Wunsch ausgezahlt werden.</p>
        <p><strong>Guthaben aufladen:</strong> Du kannst auch vorab einen größeren Betrag überweisen oder bar in der Fahrschule zahlen (z. B. 750 €). Davon bezahlst du dann Grundbetrag, Fahrstunden und Prüfungen mit einem Tipp.</p>
      </>}>
        {sp.aufgeladen && <div className="alert alert-ok" role="status">Danke! Dein Guthaben wurde aufgeladen.</div>}
        {sp.aufladen === "pruefen" && <div className="alert alert-info" role="status">Die Zahlung wird noch geprüft – dein Guthaben erscheint in wenigen Minuten. Du bekommst eine Nachricht.</div>}
        {sp.aufladen === "abgebrochen" && <div className="alert alert-info" role="status">Aufladen abgebrochen – es wurde nichts bezahlt.</div>}
        {sp.aufladen_fehler && <div className="alert alert-error" role="alert">{sp.aufladen_fehler}</div>}
        <details className="mini-details" open={!!(sp.aufladen_fehler || sp.aufladen)}><summary>Guthaben aufladen</summary>
          <div className="topup">
            {providers.includes("stripe") && (
              <form action="/api/guthaben/aufladen" method="post" className="topup-form">
                <p><strong>Online aufladen</strong> – mit Karte, Apple Pay, Google Pay oder Klarna. {formatPrice(TOPUP_MIN_CENTS).replace(",00", "")} bis {formatPrice(TOPUP_MAX_CENTS).replace(",00", "")}.</p>
                <div className="topup-quick">
                  {[200, 500, 750, 1000].map((v) => <label key={v} className="chip"><input type="radio" name="amount" value={v} defaultChecked={v === 500} /> <span>{v} €</span></label>)}
                </div>
                <label className="topup-own">oder eigener Betrag: <span style={{ whiteSpace: "nowrap" }}><input type="number" name="own" min={TOPUP_MIN_CENTS / 100} max={TOPUP_MAX_CENTS / 100} step={1} inputMode="numeric" placeholder="z. B. 650" aria-label="Eigener Betrag in Euro" /> €</span></label>
                {stripeTestMode() && <p className="test-hint">Testmodus – kein echtes Geld. Testkarte <strong>4242 4242 4242 4242</strong>, Datum in der Zukunft, Prüfnummer 123.</p>}
                <label className="check"><input type="checkbox" name="terms" required /> <span>Ich weiß: Guthaben wird mit Grundbetrag, Fahrstunden und Prüfungen verrechnet. Nicht verbrauchtes Guthaben zahlt die Fahrschule am Ende der Ausbildung auf Wunsch zurück.</span></label>
                <button className="btn btn-gold" type="submit">Jetzt aufladen</button>
              </form>
            )}
            <p><strong>Per Überweisung</strong> (kostenlos) oder bar in der Fahrschule – sobald das Geld da ist, trägt die Fahrschule es ein und du bekommst eine Nachricht.</p>
            {bank ? <pre className="bank-box">{bank}{"\n"}Verwendungszweck: Guthaben {user.name}</pre>
              : <p className="hint">Die Bankverbindung trägt die Fahrschule bald hier ein. Bis dahin: bar in der Fahrschule oder im Chat nachfragen.</p>}
          </div>
        </details>
        {ledger.length > 0 && (
          <details className="mini-details"><summary>Bewegungen ansehen</summary>
          <ul className="list ledger">
            {ledger.map((e) => (
              <li key={e.id}>
                <span>{CREDIT_LABEL[e.reason]}{e.note ? ` · ${e.note}` : ""} <span className="hint">· {fmtDate(e.createdAt)}</span></span>
                <strong className={e.amountCents < 0 ? "neg" : "pos"}>{e.amountCents > 0 ? "+" : "−"}{formatPrice(Math.abs(e.amountCents))}</strong>
              </li>
            ))}
          </ul></details>
        )}
      </Panel>

      {notes.length > 0 && (
        <Panel icon="bell" title={<>Mitteilungen {unread > 0 && <span className="tab-count">{unread}</span>}</>} helpTitle="Mitteilungen"
          right={unread > 0 ? <form action={markReadAction}><button className="link-btn" type="submit">Alle gelesen</button></form> : undefined}
          help={<p>Hier landen automatische Mitteilungen: Bestätigungen, Erinnerungen, Warteliste. Für Fragen an die Fahrschule nutze den Chat.</p>}>
          <ul className="note-list">
            {notes.map((n) => (
              <li key={n.id} className={n.readAt ? "" : "unread"}>
                <details>
                  <summary><span className="note-dot" aria-hidden />{n.title}<small>{fmtDate(n.createdAt)}</small></summary>
                  <div className="pre">{n.body}</div>
                </details>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {products.length > 0 && (
        <Panel icon="star" title="Weitere Leistungen" help={<p>Zusätzliche Angebote der Fahrschule. Alle Preise inkl. MwSt.</p>}>
          <div className="product-grid">
            {products.map((o) => (
              <div key={o.id} className="product">
                <strong>{o.title}</strong>
                <p className="hint">{o.description}</p>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <span className="price-sm">{formatPrice(o.priceCents)}</span>
                  <form action={orderProductAction}>
                    <input type="hidden" name="offerId" value={o.id} />
                    <button className="btn btn-small" type="submit">{o.needsApproval ? "Anfragen" : "Kaufen"}</button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {history.length > 0 && (
        <details className="panel">
          <summary className="panel-head"><span className="panel-ico"><svg viewBox="0 0 24 24" className="ico" aria-hidden><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5M12 7v5l3 2" /></svg></span><h2>Verlauf</h2></summary>
          <ul className="list">
            {history.map((b) => (
              <li key={b.id}>
                <span>{b.title}{b.startsAt ? ` · ${fmtDay(b.startsAt)}` : ""}{b.refundCents ? ` · ${formatPrice(b.refundCents)} erstattet` : ""}</span>
                <span className={`badge ${STATUS[b.status].cls}`}>{b.status === "paid" ? "Bezahlt" : STATUS[b.status].label}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}
