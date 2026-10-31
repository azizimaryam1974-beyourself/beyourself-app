import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { currentPackage } from "@/lib/server/repo";
import { getSettings, listBookingsForUser, listNotifications, listOffers, type Booking } from "@/lib/server/booking";
import { availableStarts, drivesInWeek, firstBookableDay, MEETING_POINTS, priceConfig, trainingWithBookings } from "@/lib/server/drive-booking";
import { availableProviders, runBookingJobs, type Provider } from "@/lib/server/payments/service";
import { cancelMyBookingAction, markReadAction, orderProductAction } from "@/app/booking-actions";
import { bookDriveAction } from "@/app/calendar-actions";
import { formatPrice } from "@/lib/language-package";
import { fmtDate, fmtDay, fmtDayShort, fmtSlot, fmtTime } from "@/lib/time";
import { CLASS_LABEL, KIND_LABEL, priceCents, type DriveKind } from "@/lib/training";
import { Countdown } from "@/components/booking/Countdown";

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
const PROVIDER_BTN: Record<Provider, string> = { stripe: "Karte · Apple Pay · Google Pay", paypal: "PayPal", test: "Test-Zahlung (Testmodus)" };
const NOTICE: Record<string, { cls: string; text: string }> = {
  bezahlt: { cls: "alert-ok", text: "Danke! Deine Zahlung ist angekommen – die Fahrt ist fest gebucht." },
  gebucht: { cls: "alert-ok", text: "Die Zeit ist für dich reserviert. Bitte bezahle jetzt, dann ist sie fest." },
  angefragt: { cls: "alert-ok", text: "Deine Anfrage ist bei der Fahrschule. Die Zeit ist so lange für dich reserviert." },
  abgesagt: { cls: "alert-ok", text: "Erledigt." },
  abgebrochen: { cls: "alert-info", text: "Die Zahlung wurde abgebrochen. Es wurde nichts abgebucht. Du kannst es innerhalb der Frist erneut versuchen." },
  pruefen: { cls: "alert-info", text: "Wir warten noch auf die Bestätigung des Zahlungsanbieters. Lade die Seite in einer Minute neu." },
  problem: { cls: "alert-error", text: "Bei der Zahlung gab es ein Problem. Schau in deine Nachrichten – die Fahrschule ist informiert." },
};

function PayBox({ b, providers }: { b: Booking; providers: Provider[] }) {
  return (
    <div className="pay-box">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <strong>{b.title}</strong> · {formatPrice(b.priceCents)}
          {b.startsAt && b.endsAt && <div>{fmtSlot(b.startsAt, b.endsAt)}</div>}
          {b.meetingPoint && <div className="hint">Treffpunkt: {b.meetingPoint}</div>}
          {b.adminMessage && <blockquote className="note">{b.adminMessage}</blockquote>}
        </div>
        <div className="pay-timer">
          <span className="hint">Bezahlen bis {fmtTime(b.payDeadline!)} Uhr</span>
          <Countdown until={b.payDeadline!} />
        </div>
      </div>
      {providers.length ? (
        <form action="/api/zahlung/start" method="post">
          <input type="hidden" name="b" value={b.id} />
          <label className="check">
            <input type="checkbox" name="terms" required />
            <span>Ich akzeptiere die <Link href="/buchungsbedingungen" target="_blank">Buchungsbedingungen</Link> und verlange, dass die Fahrschule
              vor Ablauf der Widerrufsfrist mit der Leistung beginnt. Mir ist bekannt, dass mein Widerrufsrecht mit vollständiger Erbringung der Leistung erlischt.</span>
          </label>
          <div className="row">
            {providers.map((p) => (
              <button key={p} className={`btn ${p === "stripe" ? "btn-gold" : p === "paypal" ? "btn-paypal" : "btn-secondary"}`} type="submit" name="provider" value={p}>{PROVIDER_BTN[p]}</button>
            ))}
          </div>
        </form>
      ) : <p className="hint">Online-Zahlung ist noch nicht eingerichtet. Bitte bezahle bar oder mit EC-Karte in der Fahrschule.</p>}
      <form action={cancelMyBookingAction}>
        <input type="hidden" name="bookingId" value={b.id} />
        <button className="link-btn" type="submit">Doch nicht – Zeit wieder freigeben</button>
      </form>
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
  const noticeKey = sp.bezahlt ? "bezahlt" : sp.gebucht ? "gebucht" : sp.angefragt ? "angefragt" : sp.abgesagt ? "abgesagt" : sp.zahlung;

  // Auswahl: Art (k), Länge (d), Startzeit (t)
  const options = training && !training.profile.blocked ? training.state.bookable : [];
  const opt = options.find((o) => o.kind === sp.k) ?? null;
  const minutes = opt && opt.durations.includes(Number(sp.d)) ? Number(sp.d) : null;
  const days = opt && minutes ? availableStarts(d, opt.kind as DriveKind, minutes, firstBookableDay(d, now), 14, now) : [];
  const chosen = minutes && sp.t && days.some((x) => x.starts.includes(Number(sp.t))) ? Number(sp.t) : null;
  const withTimes = days.filter((x) => x.starts.length);
  const selDay = days.find((x) => x.day === sp.tag && x.starts.length) ?? (chosen ? days.find((x) => x.starts.includes(chosen)) : null) ?? withTimes[0] ?? null;
  const weekCount = chosen ? drivesInWeek(d, user.id, chosen) : 0;
  const link = (q: Record<string, string | number>) => `/termine?${new URLSearchParams(Object.entries(q).map(([k, v]) => [k, String(v)])).toString()}#buchen`;

  return (
    <>
      <h1>Termine & Buchen</h1>
      {noticeKey && NOTICE[noticeKey] && <div className={`alert ${NOTICE[noticeKey].cls}`} role="status">{NOTICE[noticeKey].text}</div>}
      {sp.fehler && <div className="alert alert-error" role="alert">{sp.fehler}</div>}

      {toPay.length > 0 && (
        <section className="card card-accent" id="offen">
          <h2>Bitte bezahlen</h2>
          {toPay.map((b) => <PayBox key={b.id} b={b} providers={providers} />)}
        </section>
      )}

      <section className="card" id="buchen">
        <h2>Fahrt buchen</h2>
        {!training ? (
          <p className="hint">Deine Führerscheinklasse ist noch nicht festgelegt. Die Fahrschule erledigt das – danach kannst du hier buchen.</p>
        ) : training.profile.blocked ? (
          <p className="hint">Online-Buchung ist für dich gerade gesperrt. Bitte melde dich bei der Fahrschule.</p>
        ) : (
          <>
            <p className="book-next"><span className="hint">{CLASS_LABEL[training.profile.licenseClass]} · </span>{training.state.next}
              {" "}<Link href="/konto" className="hint">Fortschritt ansehen</Link></p>
            {options.length === 0 ? (
              <p className="hint">Gerade gibt es für dich nichts zu buchen.</p>
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
      </section>

      <section className="card" id="meine">
        <h2>Meine Termine</h2>
        {active.length === 0 ? <p className="hint">Noch keine Termine.</p> : (
          <ul className="list">
            {active.map((b) => {
              const canCancel = b.status === "requested" || (b.startsAt ?? 0) - now >= settings.freeCancelHours * 3_600_000;
              return (
                <li key={b.id}>
                  <div>
                    <strong>{b.title}</strong>
                    <div>{b.startsAt && b.endsAt ? fmtSlot(b.startsAt, b.endsAt) : formatPrice(b.priceCents)}</div>
                    {b.meetingPoint && <div className="hint">Treffpunkt: {b.meetingPoint}</div>}
                    {b.adminMessage && b.status === "paid" && <blockquote className="note">{b.adminMessage}</blockquote>}
                  </div>
                  <div className="row">
                    <span className={`badge ${STATUS[b.status].cls}`}>{STATUS[b.status].label}</span>
                    {canCancel ? (
                      <form action={cancelMyBookingAction}>
                        <input type="hidden" name="bookingId" value={b.id} />
                        <button className="btn btn-secondary btn-small" type="submit">{b.status === "requested" ? "Anfrage zurückziehen" : "Absagen"}</button>
                      </form>
                    ) : <span className="hint">Absage nur noch über die Fahrschule</span>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {notes.length > 0 && (
        <section className="card">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h2 style={{ margin: 0 }}>Nachrichten {unread > 0 && <span className="tab-count">{unread}</span>}</h2>
            {unread > 0 && <form action={markReadAction}><button className="link-btn" type="submit">Alle gelesen</button></form>}
          </div>
          <ul className="list notes">
            {notes.map((n) => (
              <li key={n.id} className={n.readAt ? "" : "unread"}>
                <div><strong>{n.title}</strong><div className="pre">{n.body}</div></div>
                <span className="hint">{fmtDate(n.createdAt)} {fmtTime(n.createdAt)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {products.length > 0 && (
        <section className="card">
          <h2>Weitere Leistungen</h2>
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
          <p className="hint">Alle Preise inkl. MwSt.</p>
        </section>
      )}

      {history.length > 0 && (
        <details className="card">
          <summary><h2 style={{ display: "inline" }}>Verlauf</h2></summary>
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
