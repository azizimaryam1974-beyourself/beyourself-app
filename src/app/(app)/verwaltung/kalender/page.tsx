import Link from "next/link";
import { requireTeacher } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { getSettings, listBookingsByStatus, listRecentPaid, listSlotsBetween, listTemplates, type Booking } from "@/lib/server/booking";
import { freeIntervals, getTemplate, listBlocks, mainTeacherId, syncFinishedDrives } from "@/lib/server/drive-booking";
import { availableProviders, runBookingJobs } from "@/lib/server/payments/service";
import { markPaidCashAction } from "@/app/booking-actions";
import { blockDayAction, deleteBlockAction } from "@/app/calendar-actions";
import { closedReason, frameFor, sunsetMs, workIntervals } from "@/lib/calendar";
import { formatPrice } from "@/lib/language-package";
import { addDays, berlinToMs, dayKey, fmtDate, fmtDay, fmtDayShort, fmtSlot, fmtTime, isDayKey, mondayOf } from "@/lib/time";
import { Countdown } from "@/components/booking/Countdown";
import { AdminTabs } from "../AdminTabs";
import { DecisionForm } from "./DecisionForm";
import { CancelForm } from "./CancelForm";

export const metadata = { title: "Kalender" };
export const dynamic = "force-dynamic";

const PROVIDER_LABEL: Record<string, string> = { stripe: "Karte/Apple Pay", paypal: "PayPal", test: "Testzahlung", bar: "bar/EC" };
const STATUS_LABEL: Record<string, string> = { requested: "Anfrage", awaiting_payment: "wartet auf Zahlung", paid: "bezahlt" };
const PX = 1.1; // Pixel je Minute in der Wochenansicht
const KIND_CLS = (k: string | null) => (k === "ueberland" || k === "autobahn" || k === "beleuchtung" ? "k-sonder" : k === "testfahrt" || k === "warmstunde" ? "k-pruef" : "k-uebung");

function Who({ b }: { b: Booking }) {
  return (
    <div>
      <Link href={`/verwaltung/schueler/${b.userId}`}><strong>{b.userName}</strong></Link>
      <div className="hint">
        {b.userPhone && <a href={`tel:${b.userPhone}`}>{b.userPhone}</a>}{b.userPhone && " · "}
        <a href={`mailto:${b.userEmail}`}>{b.userEmail}</a>
      </div>
    </div>
  );
}

interface Item { b: Booking; start: number; end: number }

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ w?: string }> }) {
  await requireTeacher();
  await runBookingJobs();
  const d = db();
  syncFinishedDrives(d);
  const tid = mainTeacherId(d)!;
  const { w } = await searchParams;
  const now = Date.now();
  const today = dayKey(now);
  const monday = mondayOf(isDayKey(w) ? w : today);
  const days = Array.from({ length: 6 }, (_, i) => addDays(monday, i));
  const from = berlinToMs(monday, "00:00"), to = berlinToMs(addDays(monday, 7), "00:00");
  const settings = getSettings(d);
  const requests = listBookingsByStatus(d, ["requested"]);
  const awaiting = listBookingsByStatus(d, ["awaiting_payment"]);
  const tpl = getTemplate(d, tid);
  const blocks = listBlocks(d, from, to);
  const items: Item[] = listSlotsBetween(d, from, to).flatMap((s) => {
    const b = s.bookings.find((x) => ["requested", "awaiting_payment", "paid"].includes(x.status));
    return b && (s.status === "reserved" || s.status === "booked") ? [{ b, start: s.startsAt, end: s.endsAt }] : [];
  });
  const t = (k: "confirm" | "decline" | "cancel") => listTemplates(d, k).map(({ id, label, body }) => ({ id, label, body }));
  const confirmT = t("confirm"), declineT = t("decline"), cancelT = t("cancel");
  const providers = availableProviders();
  const recentPaid = listRecentPaid(d, 8);
  const maxEnd = Math.max(...days.map((day) => frameFor(day).to));
  const minStart = 9 * 60;
  const hours = Array.from({ length: (maxEnd - minStart) / 60 + 1 }, (_, i) => minStart + i * 60);
  const minOf = (ms: number, day: string) => Math.round((ms - berlinToMs(day, "00:00")) / 60_000);
  const weekTotal = items.filter((i) => i.b.status === "paid").reduce((a, i) => a + i.b.priceCents, 0);

  const BookingPop = ({ it }: { it: Item }) => (
    <div className="tl-pop">
      <Who b={it.b} />
      <div><strong>{it.b.title}</strong> · {formatPrice(it.b.priceCents)}</div>
      <div>{fmtTime(it.start)}–{fmtTime(it.end)} Uhr · {it.b.meetingPoint || "Treffpunkt Fahrschule"}</div>
      {it.b.studentNote && <blockquote className="note">„{it.b.studentNote}“</blockquote>}
      <div><span className={`badge ${it.b.status === "paid" ? "badge-ok" : "badge-warn"}`}>{STATUS_LABEL[it.b.status]}</span>
        {it.b.status === "paid" && it.b.provider && <span className="hint"> · {PROVIDER_LABEL[it.b.provider] ?? it.b.provider}</span>}</div>
      {it.b.status === "requested" && <a href="#anfragen">Zur Anfrage →</a>}
      {it.b.status === "awaiting_payment" && (
        <form action={markPaidCashAction}><input type="hidden" name="bookingId" value={it.b.id} /><button className="btn btn-secondary btn-small" type="submit">Bar/EC bezahlt</button></form>
      )}
      {it.start > now && it.b.status !== "requested" && <CancelForm bookingId={it.b.id} templates={cancelT} paid={it.b.status === "paid"} />}
    </div>
  );

  return (
    <>
      <h1>Kalender</h1>
      <AdminTabs active="/verwaltung/kalender" />

      {providers.length === 0 && (
        <div className="alert alert-info"><strong>Online-Zahlung ist noch nicht eingerichtet.</strong> Buchungen funktionieren schon; Zahlungen markierst du mit „Bar/EC bezahlt“.</div>
      )}
      {providers.includes("test") && <div className="alert alert-error"><strong>Testmodus:</strong> Schüler können mit einer Test-Zahlung „bezahlen“. Vor dem echten Start ausschalten.</div>}

      {requests.length > 0 && (
        <section className="card card-accent" id="anfragen">
          <h2>Anfragen zur Freigabe <span className="tab-count">{requests.length}</span></h2>
          <p className="hint">Nur von Schülern, bei denen „nur mit meiner Freigabe“ eingeschaltet ist. Die Zeit ist so lange für sie reserviert.</p>
          <ul className="list req-list">
            {requests.map((b) => (
              <li key={b.id}>
                <div className="req-main">
                  <Who b={b} />
                  <div className="req-what">
                    <strong>{b.title}</strong> · {formatPrice(b.priceCents)}
                    <div>{b.startsAt && b.endsAt ? fmtSlot(b.startsAt, b.endsAt) : "ohne Termin"}</div>
                    {b.meetingPoint && <div className="hint">Treffpunkt: {b.meetingPoint}</div>}
                    {b.studentNote && <blockquote className="note">„{b.studentNote}“</blockquote>}
                  </div>
                </div>
                <DecisionForm bookingId={b.id} confirmTemplates={confirmT} declineTemplates={declineT} payWindowMin={settings.payWindowMin} />
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
          <span><i className="lg lg-work" /> Arbeitszeit (frei)</span><span><i className="lg k-uebung" /> Übungsfahrt</span>
          <span><i className="lg k-sonder" /> Sonderfahrt</span><span><i className="lg k-pruef" /> Test/Warmstunde</span>
          <span><i className="lg lg-block" /> gesperrt</span><span>☾ Sonnenuntergang</span>
          <span>· {items.length} Fahrten, {formatPrice(weekTotal)} bezahlt</span>
        </div>

        {/* Wochenansicht (Laptop/Tablet) */}
        <div className="tl" style={{ ["--tl-h" as string]: `${(maxEnd - minStart) * PX}px` }}>
          <div className="tl-axis">
            {hours.map((h) => <span key={h} style={{ top: (h - minStart) * PX }}>{String(h / 60).padStart(2, "0")}:00</span>)}
          </div>
          {days.map((day) => {
            const closed = closedReason(day);
            const wd = (new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7;
            const work = closed ? [] : workIntervals(day, tpl[wd]);
            const dayItems = items.filter((i) => dayKey(i.start) === day);
            const dayBlocks = blocks.filter((b) => b.endsAt > berlinToMs(day, "00:00") && b.startsAt < berlinToMs(addDays(day, 1), "00:00"));
            const sunset = minOf(sunsetMs(day), day);
            const f = frameFor(day);
            return (
              <div key={day} className={`tl-day ${day === today ? "today" : ""} ${day < today ? "past" : ""}`}>
                <div className="tl-head">
                  <span>{fmtDayShort(berlinToMs(day, "12:00"))}</span>
                  {!closed && day >= today && (
                    <form action={blockDayAction}><input type="hidden" name="day" value={day} /><button className="link-btn" type="submit" title="Ganzen Tag sperren">sperren</button></form>
                  )}
                </div>
                <div className="tl-body">
                  {closed && <div className="tl-closed">{closed}</div>}
                  {f.to < maxEnd && <div className="tl-out" style={{ top: (f.to - minStart) * PX, height: (maxEnd - f.to) * PX }} />}
                  {work.map((wk, i) => {
                    const a = minOf(wk.start, day), b = minOf(wk.end, day);
                    return <div key={i} className="tl-work" style={{ top: (a - minStart) * PX, height: (b - a) * PX }} />;
                  })}
                  {!closed && sunset > minStart && sunset < maxEnd && <div className="tl-sun" style={{ top: (sunset - minStart) * PX }} title={`Sonnenuntergang ${fmtTime(sunsetMs(day))}`}>☾</div>}
                  {dayBlocks.map((b) => {
                    const a = Math.max(minStart, minOf(Math.max(b.startsAt, berlinToMs(day, "00:00")), day));
                    const e = Math.min(maxEnd, minOf(Math.min(b.endsAt, berlinToMs(addDays(day, 1), "00:00")), day));
                    if (e <= a) return null;
                    return (
                      <div key={b.id} className="tl-block" style={{ top: (a - minStart) * PX, height: (e - a) * PX }}>
                        <span>{b.note || "gesperrt"}</span>
                        <form action={deleteBlockAction}><input type="hidden" name="id" value={b.id} /><button className="link-btn" type="submit">aufheben</button></form>
                      </div>
                    );
                  })}
                  {dayItems.map((it) => {
                    const a = minOf(it.start, day), e = minOf(it.end, day);
                    return (
                      <details key={it.b.id} className={`tl-item ${KIND_CLS(it.b.kind)} st-${it.b.status} ${it.end < now ? "done" : ""}`} style={{ top: (a - minStart) * PX, height: (e - a) * PX }}>
                        <summary>
                          <b>{fmtTime(it.start)}</b> {it.b.userName?.split(" ")[0]}
                          <span className="tl-sub">{it.b.title}</span>
                        </summary>
                        <BookingPop it={it} />
                      </details>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Tagesliste (Handy) */}
        <div className="tl-list">
          {days.map((day) => {
            const closed = closedReason(day);
            const dayItems = items.filter((i) => dayKey(i.start) === day).sort((a, b) => a.start - b.start);
            const free = closed ? [] : freeIntervals(d, tid, day).filter((i) => i.end > now);
            const dayBlocks = blocks.filter((b) => b.endsAt > berlinToMs(day, "00:00") && b.startsAt < berlinToMs(addDays(day, 1), "00:00"));
            if (day < today && !dayItems.length) return null;
            return (
              <div key={day} className={`tl-list-day ${day === today ? "today" : ""}`}>
                <div className="tl-list-head">
                  <strong>{fmtDay(berlinToMs(day, "12:00"))}</strong>
                  {closed ? <span className="badge badge-muted">{closed}</span> : day >= today && (
                    <form action={blockDayAction}><input type="hidden" name="day" value={day} /><button className="link-btn" type="submit">Tag sperren</button></form>
                  )}
                </div>
                {dayItems.map((it) => (
                  <details key={it.b.id} className={`tl-row ${KIND_CLS(it.b.kind)} st-${it.b.status}`}>
                    <summary><b>{fmtTime(it.start)}–{fmtTime(it.end)}</b> {it.b.userName} · {it.b.title} <span className="hint">· {STATUS_LABEL[it.b.status]}</span></summary>
                    <BookingPop it={it} />
                  </details>
                ))}
                {dayBlocks.map((b) => (
                  <div key={b.id} className="tl-row lg-block-row">
                    <span>gesperrt {fmtTime(Math.max(b.startsAt, berlinToMs(day, "00:00")))}–{b.endsAt >= berlinToMs(addDays(day, 1), "00:00") ? "24:00" : fmtTime(b.endsAt)} {b.note && `· ${b.note}`}</span>
                    <form action={deleteBlockAction}><input type="hidden" name="id" value={b.id} /><button className="link-btn" type="submit">aufheben</button></form>
                  </div>
                ))}
                {!closed && free.length > 0 && <div className="hint tl-free">frei: {free.map((i) => `${fmtTime(i.start)}–${fmtTime(i.end)}`).join(", ")}</div>}
              </div>
            );
          })}
        </div>
        <p className="hint" style={{ marginTop: 12 }}>Arbeitszeiten und Urlaub änderst du unter <Link href="/verwaltung/arbeitszeiten">Arbeitszeiten</Link>.</p>
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
                <form action={markPaidCashAction}>
                  <input type="hidden" name="bookingId" value={b.id} />
                  <button className="btn btn-secondary btn-small" type="submit">Bar/EC bezahlt</button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

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
