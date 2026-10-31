import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { currentPackage } from "@/lib/server/repo";
import { getSettings, listBookingsForUser, listNotifications, listOffers, listOpenSlots, type Booking } from "@/lib/server/booking";
import { availableProviders, runBookingJobs, type Provider } from "@/lib/server/payments/service";
import { cancelMyBookingAction, markReadAction, orderProductAction, requestSlotAction } from "@/app/booking-actions";
import { formatPrice } from "@/lib/language-package";
import { dayKey, fmtDate, fmtDay, fmtSlot, fmtTime } from "@/lib/time";
import { Countdown } from "@/components/booking/Countdown";

export const metadata = { title: "Termine & Buchen" };
export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; cls: string }> = {
  requested: { label: "Angefragt – wartet auf Bestätigung", cls: "badge-warn" },
  awaiting_payment: { label: "Bestätigt – bitte bezahlen", cls: "badge-warn" },
  paid: { label: "Gebucht", cls: "badge-ok" },
  declined: { label: "Abgelehnt", cls: "badge-muted" },
  expired: { label: "Frist abgelaufen", cls: "badge-muted" },
  cancelled: { label: "Abgesagt", cls: "badge-muted" },
  withdrawn: { label: "Zurückgezogen", cls: "badge-muted" },
};
const PROVIDER_BTN: Record<Provider, string> = { stripe: "Karte · Apple Pay · Google Pay", paypal: "PayPal", test: "Test-Zahlung (Testmodus)" };
const NOTICE: Record<string, { cls: string; text: string }> = {
  bezahlt: { cls: "alert-ok", text: "Danke! Deine Zahlung ist angekommen – der Termin ist fest gebucht." },
  angefragt: { cls: "alert-ok", text: "Deine Anfrage ist bei der Fahrschule. Du bekommst eine Nachricht, sobald sie bestätigt ist." },
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
        <button className="link-btn" type="submit">Doch nicht – Termin freigeben</button>
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
  const offers = listOffers(d, { bookableOnly: true });
  const filter = offers.find((o) => o.id === sp.a)?.id;
  const slots = listOpenSlots(d, user.id, now, now + 35 * 24 * 3_600_000).filter((s) => !filter || s.offerId === filter);
  const mine = listBookingsForUser(d, user.id);
  const toPay = mine.filter((b) => b.status === "awaiting_payment");
  const active = mine.filter((b) => b.status === "requested" || (b.status === "paid" && (b.startsAt ?? 0) > now));
  const history = mine.filter((b) => !active.includes(b) && !toPay.includes(b)).slice(0, 15);
  const notes = listNotifications(d, user.id, 10);
  const unread = notes.filter((n) => !n.readAt).length;
  const providers = availableProviders();
  const pkg = currentPackage(d, user.id);
  const products = offers.filter((o) => o.kind === "product" || (o.kind === "language" && pkg?.status === "booked"));
  const slotOffers = offers.filter((o) => o.kind === "slot");
  const days = [...new Set(slots.map((s) => dayKey(s.startsAt)))];
  const noticeKey = sp.bezahlt ? "bezahlt" : sp.angefragt ? "angefragt" : sp.abgesagt ? "abgesagt" : sp.zahlung;

  return (
    <>
      <h1>Termine & Buchen</h1>
      {noticeKey && NOTICE[noticeKey] && <div className={`alert ${NOTICE[noticeKey].cls}`} role="status">{NOTICE[noticeKey].text}</div>}
      {sp.fehler && <div className="alert alert-error" role="alert">{sp.fehler}</div>}

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

      {toPay.length > 0 && (
        <section className="card card-accent" id="offen">
          <h2>Bitte bezahlen</h2>
          {toPay.map((b) => <PayBox key={b.id} b={b} providers={providers} />)}
        </section>
      )}

      <section className="card" id="meine">
        <h2>Meine Termine</h2>
        {active.length === 0 ? <p className="hint">Noch keine Termine. Wähle unten einen freien Termin.</p> : (
          <ul className="list">
            {active.map((b) => {
              const canCancel = b.status === "requested" || (b.startsAt ?? 0) - now >= settings.freeCancelHours * 3_600_000;
              return (
                <li key={b.id}>
                  <div>
                    <strong>{b.title}</strong>
                    <div>{b.startsAt && b.endsAt ? fmtSlot(b.startsAt, b.endsAt) : formatPrice(b.priceCents)}</div>
                    {b.adminMessage && b.status === "paid" && <blockquote className="note">{b.adminMessage}</blockquote>}
                  </div>
                  <div className="row">
                    <span className={`badge ${STATUS[b.status].cls}`}>{STATUS[b.status].label}</span>
                    {canCancel ? (
                      <form action={cancelMyBookingAction}>
                        <input type="hidden" name="bookingId" value={b.id} />
                        <button className="btn btn-secondary btn-small" type="submit">
                          {b.status === "requested" ? "Anfrage zurückziehen" : "Absagen (Geld zurück)"}
                        </button>
                      </form>
                    ) : <span className="hint">Absage nur noch über die Fahrschule</span>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <p className="hint">Bezahlte Fahrstunden kannst du bis {settings.freeCancelHours} Stunden vorher kostenlos absagen.</p>
      </section>

      <section className="card" id="frei">
        <h2>Freie Termine</h2>
        {slotOffers.length > 1 && (
          <div className="chips" style={{ marginBottom: 14 }}>
            <Link className={`chip ${!filter ? "on" : ""}`} href="/termine#frei">Alle</Link>
            {slotOffers.map((o) => <Link key={o.id} className={`chip ${filter === o.id ? "on" : ""}`} href={`/termine?a=${o.id}#frei`}>{o.title}</Link>)}
          </div>
        )}
        {days.length === 0 ? <p className="hint">Gerade sind keine freien Termine eingetragen. Schau bald wieder vorbei – neue Termine erscheinen hier automatisch.</p> : (
          days.map((day) => (
            <div key={day} className="free-day">
              <h3>{fmtDay(slots.find((s) => dayKey(s.startsAt) === day)!.startsAt)}</h3>
              <ul className="list">
                {slots.filter((s) => dayKey(s.startsAt) === day).map((s) => (
                  <li key={s.id}>
                    <div><strong>{fmtTime(s.startsAt)}–{fmtTime(s.endsAt)} Uhr</strong> · {s.offer.title}<div className="hint">{formatPrice(s.offer.priceCents)}</div></div>
                    {s.myBooking ? <span className="badge badge-warn">angefragt</span> : (
                      <details className="ask">
                        <summary className="btn btn-small">Anfragen</summary>
                        <form action={requestSlotAction}>
                          <input type="hidden" name="slotId" value={s.id} />
                          <label htmlFor={`n-${s.id}`}>Nachricht an die Fahrschule (optional)</label>
                          <input id={`n-${s.id}`} type="text" name="note" maxLength={300} placeholder="z. B. Abholung an der Schule" />
                          <button className="btn btn-gold btn-small" type="submit">Anfrage senden</button>
                        </form>
                      </details>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
        <p className="hint">So geht’s: Termin anfragen → die Fahrschule bestätigt → du hast {settings.payWindowMin} Minuten zum Bezahlen → der Termin ist fest.</p>
      </section>

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
