import Link from "next/link";
import { requireTeacher } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import {
  getSettings, isBookable, listBookingsByStatus, listOffers, listRecentPaid, listSlotsBetween, listTemplates, type Booking,
} from "@/lib/server/booking";
import { availableProviders, runBookingJobs } from "@/lib/server/payments/service";
import { closeSlotAction, markPaidCashAction } from "@/app/booking-actions";
import { formatPrice } from "@/lib/language-package";
import { addDays, berlinToMs, dayKey, fmtDate, fmtDay, fmtDayShort, fmtSlot, fmtTime, isDayKey, mondayOf } from "@/lib/time";
import { Countdown } from "@/components/booking/Countdown";
import { AdminTabs } from "../AdminTabs";
import { SlotCreator } from "./SlotCreator";
import { DecisionForm } from "./DecisionForm";
import { CancelForm } from "./CancelForm";

export const metadata = { title: "Kalender" };
export const dynamic = "force-dynamic";

const PROVIDER_LABEL: Record<string, string> = { stripe: "Karte/Apple Pay", paypal: "PayPal", test: "Testzahlung", bar: "bar/EC" };

function Who({ b }: { b: Booking }) {
  return (
    <div>
      <strong>{b.userName}</strong>
      <div className="hint">
        {b.userPhone && <a href={`tel:${b.userPhone}`}>{b.userPhone}</a>}{b.userPhone && " · "}
        <a href={`mailto:${b.userEmail}`}>{b.userEmail}</a>
      </div>
    </div>
  );
}

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ w?: string }> }) {
  await requireTeacher();
  await runBookingJobs();
  const d = db();
  const { w } = await searchParams;
  const today = dayKey(Date.now());
  const monday = mondayOf(isDayKey(w) ? w : today);
  const from = berlinToMs(monday, "00:00"), to = berlinToMs(addDays(monday, 7), "00:00");
  const slots = listSlotsBetween(d, from, to);
  const settings = getSettings(d);
  const requests = listBookingsByStatus(d, ["requested"]);
  const awaiting = listBookingsByStatus(d, ["awaiting_payment"]);
  const offers = listOffers(d);
  const slotOffers = offers.filter((o) => o.kind === "slot" && o.active);
  const tpl = (k: "confirm" | "decline" | "cancel") => listTemplates(d, k).map(({ id, label, body }) => ({ id, label, body }));
  const confirmT = tpl("confirm"), declineT = tpl("decline"), cancelT = tpl("cancel");
  const providers = availableProviders();
  const recentPaid = listRecentPaid(d, 8);
  const missingPrice = slotOffers.filter((o) => !isBookable(o));
  const now = Date.now();

  return (
    <>
      <h1>Kalender</h1>
      <AdminTabs active="/verwaltung/kalender" />

      {providers.length === 0 && (
        <div className="alert alert-info">
          <strong>Online-Zahlung ist noch nicht eingerichtet.</strong> Anfragen und Bestätigungen funktionieren schon. Bis Stripe/PayPal
          verbunden sind, markierst du Zahlungen mit „Bar bezahlt“.
        </div>
      )}
      {providers.includes("test") && <div className="alert alert-error"><strong>Testmodus:</strong> Schüler können mit einer Test-Zahlung „bezahlen“. Vor dem echten Start ausschalten.</div>}
      {missingPrice.length > 0 && (
        <div className="alert alert-info">
          Noch ohne Preis (für Schüler unsichtbar): {missingPrice.map((o) => o.title).join(", ")}. <Link href="/verwaltung/angebote">Preise eintragen →</Link>
        </div>
      )}

      <section className="card" id="anfragen">
        <h2>Offene Anfragen {requests.length > 0 && <span className="tab-count">{requests.length}</span>}</h2>
        {requests.length === 0 ? <p className="hint">Keine offenen Anfragen.</p> : (
          <ul className="list req-list">
            {requests.map((b) => {
              const competitors = b.slotId ? requests.filter((o) => o.slotId === b.slotId).length - 1 : 0;
              const past = !!b.startsAt && b.startsAt < now;
              return (
                <li key={b.id}>
                  <div className="req-main">
                    <Who b={b} />
                    <div className="req-what">
                      <strong>{b.title}</strong> · {formatPrice(b.priceCents)}
                      <div>{b.startsAt && b.endsAt ? fmtSlot(b.startsAt, b.endsAt) : "ohne Termin"}{past && <span className="badge badge-muted"> vorbei</span>}</div>
                      {competitors > 0 && <div className="hint">{competitors} weitere Anfrage{competitors > 1 ? "n" : ""} für diesen Termin</div>}
                      {b.studentNote && <blockquote className="note">„{b.studentNote}“</blockquote>}
                    </div>
                  </div>
                  <DecisionForm bookingId={b.id} confirmTemplates={confirmT} declineTemplates={declineT} payWindowMin={settings.payWindowMin} />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {awaiting.length > 0 && (
        <section className="card">
          <h2>Warten auf Zahlung</h2>
          <ul className="list">
            {awaiting.map((b) => (
              <li key={b.id}>
                <div className="req-main">
                  <Who b={b} />
                  <div className="req-what">
                    <strong>{b.title}</strong> · {formatPrice(b.priceCents)}
                    {b.startsAt && b.endsAt && <div>{fmtSlot(b.startsAt, b.endsAt)}</div>}
                    <div className="hint">Frist: <Countdown until={b.payDeadline!} /></div>
                  </div>
                </div>
                <div className="row">
                  <form action={markPaidCashAction}>
                    <input type="hidden" name="bookingId" value={b.id} />
                    <button className="btn btn-secondary btn-small" type="submit">Bar/EC bezahlt</button>
                  </form>
                  <CancelForm bookingId={b.id} templates={cancelT} paid={false} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card">
        <div className="cal-head">
          <h2 style={{ margin: 0 }}>Woche ab {fmtDate(berlinToMs(monday, "12:00"))}</h2>
          <div className="row">
            <Link className="btn btn-secondary btn-small" href={`/verwaltung/kalender?w=${addDays(monday, -7)}`} aria-label="Vorige Woche">←</Link>
            <Link className="btn btn-secondary btn-small" href="/verwaltung/kalender">Heute</Link>
            <Link className="btn btn-secondary btn-small" href={`/verwaltung/kalender?w=${addDays(monday, 7)}`} aria-label="Nächste Woche">→</Link>
          </div>
        </div>
        <div className="cal-legend hint">
          <span><i className="lg open" /> frei</span><span><i className="lg req" /> angefragt</span>
          <span><i className="lg reserved" /> wartet auf Zahlung</span><span><i className="lg booked" /> gebucht</span>
        </div>
        <div className="cal-week">
          {Array.from({ length: 7 }, (_, i) => addDays(monday, i)).map((day) => {
            const daySlots = slots.filter((s) => dayKey(s.startsAt) === day);
            return (
              <div key={day} className={`cal-day ${day === today ? "today" : ""} ${day < today ? "past" : ""}`}>
                <div className="cal-day-head">{fmtDayShort(berlinToMs(day, "12:00"))}</div>
                {daySlots.length === 0 && <div className="hint cal-empty">–</div>}
                {daySlots.map((s) => {
                  const active = s.bookings.find((b) => b.status === "awaiting_payment" || b.status === "paid");
                  const reqs = s.bookings.filter((b) => b.status === "requested");
                  const cls = s.status === "booked" ? "booked" : s.status === "reserved" ? "reserved" : reqs.length ? "req" : "open";
                  return (
                    <div key={s.id} className={`cal-slot ${cls} ${s.endsAt < now ? "done" : ""}`}>
                      <div className="cal-time">{fmtTime(s.startsAt)}–{fmtTime(s.endsAt)}</div>
                      <div className="cal-title">{s.offer?.title}</div>
                      {active && <div className="cal-who">{active.userName}{active.status === "paid" && active.provider ? ` · ${PROVIDER_LABEL[active.provider] ?? active.provider}` : ""}</div>}
                      {!active && reqs.length > 0 && <a className="cal-who" href="#anfragen">{reqs.length} Anfrage{reqs.length > 1 ? "n" : ""}</a>}
                      {s.status === "open" && s.startsAt > now && (
                        <form action={closeSlotAction}>
                          <input type="hidden" name="slotId" value={s.id} />
                          <button className="link-btn" type="submit">Termin löschen</button>
                        </form>
                      )}
                      {active?.status === "paid" && s.startsAt > now && <CancelForm bookingId={active.id} templates={cancelT} paid />}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </section>

      <section className="card" id="freigeben">
        <h2>Termine freigeben</h2>
        <p className="hint">Schüler sehen freie Termine ab {settings.minLeadHours} Stunden im Voraus und können sie anfragen. Du entscheidest dann.</p>
        {slotOffers.length === 0 ? <p>Lege zuerst unter <Link href="/verwaltung/angebote">Angebote & Preise</Link> eine Fahrstunden-Art an.</p>
          : <SlotCreator offers={slotOffers.map((o) => ({ id: o.id, title: o.title, durationMin: o.durationMin, bookable: isBookable(o) }))} defaultDate={monday < today ? today : monday} />}
      </section>

      {recentPaid.length > 0 && (
        <section className="card">
          <h2>Letzte Zahlungen</h2>
          <ul className="list">
            {recentPaid.map((b) => (
              <li key={b.id}>
                <span><strong>{b.userName}</strong> · {b.title}{b.startsAt ? ` · ${fmtDay(b.startsAt)}` : ""}</span>
                <span className="hint">{formatPrice(b.priceCents)} · {PROVIDER_LABEL[b.provider ?? ""] ?? b.provider} · {b.paidAt ? fmtDate(b.paidAt) : ""}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
