import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTeacher } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { getBooking, listTemplates } from "@/lib/server/booking";
import { destinationFor } from "@/lib/server/calendar-month";
import { trainingWithBookings } from "@/lib/server/drive-booking";
import { addressLine, getDetails } from "@/lib/server/user-details";
import { creditBalance } from "@/lib/server/credit";
import { markPaidCashAction } from "@/app/booking-actions";
import { recordStatusAction } from "@/app/training-actions";
import { NaviButton } from "@/components/calendar/NaviButton";
import { Avatar } from "@/components/ui/Avatar";
import { CancelForm } from "../../CancelForm";
import { formatPrice } from "@/lib/language-package";
import { CLASS_LABEL, KIND_LABEL } from "@/lib/training";
import { waLink, telLink } from "@/lib/phone";
import { dayKey, fmtDay, fmtTime } from "@/lib/time";

export const dynamic = "force-dynamic";
export const metadata = { title: "Termin" };

const STATUS: Record<string, [string, string]> = { requested: ["Anfrage – wartet auf deine Freigabe", "badge-warn"], awaiting_payment: ["Zahlung offen", "badge-warn"], paid: ["bezahlt", "badge-ok"], cancelled: ["abgesagt", "badge-muted"], expired: ["verfallen", "badge-muted"], declined: ["abgelehnt", "badge-muted"], withdrawn: ["zurückgezogen", "badge-muted"] };
const PROVIDER: Record<string, string> = { stripe: "Karte/Apple Pay/Klarna", paypal: "PayPal", bar: "bar/EC", guthaben: "Guthaben", test: "Testzahlung" };
const REC: Record<string, string> = { done: "gefahren", no_show: "nicht erschienen", late: "zu spät (ausgefallen)" };

/** Ein Termin im Detail: Schüler, Fahrt, Treffpunkt mit Navi, Anrufen/WhatsApp, bezahlt/absagen/gefahren. */
export default async function TerminPage({ params }: { params: Promise<{ id: string }> }) {
  await requireTeacher();
  const { id } = await params;
  const d = db();
  const b = getBooking(d, id);
  if (!b || !b.startsAt || !b.endsAt) notFound();
  const now = Date.now();
  const det = getDetails(d, b.userId);
  const t = trainingWithBookings(d, b.userId, now);
  const dest = destinationFor(d, b);
  const rec = d.prepare(`SELECT id, status FROM drive_records WHERE booking_id = ?`).get(b.id) as { id: string; status: string } | undefined;
  const cancelT = listTemplates(d, "cancel").map(({ id, label, body }) => ({ id, label, body }));
  const st = STATUS[b.status] ?? [b.status, ""];
  const tel = telLink(b.userPhone), wa = waLink(b.userPhone);
  const age = det.birthday ? Math.floor((now - Date.parse(det.birthday)) / (365.25 * 86_400_000)) : null;

  return (
    <div className="termin">
      <Link className="back-link" href={`/verwaltung/kalender?tag=${dayKey(b.startsAt)}`}>← Kalender</Link>

      <section className="termin-hero">
        <div className="termin-when">
          <small>{fmtDay(b.startsAt)}</small>
          <strong>{fmtTime(b.startsAt)}–{fmtTime(b.endsAt)} Uhr</strong>
          <span>{b.kind ? KIND_LABEL[b.kind as keyof typeof KIND_LABEL] : b.title} · {b.minutes ?? Math.round((b.endsAt - b.startsAt) / 60_000)} Min · {formatPrice(b.priceCents)}</span>
          <span className={`badge ${st[1]}`}>{b.examId ? "Prüfung · " : ""}{st[0]}{b.status === "paid" && b.provider ? ` · ${PROVIDER[b.provider] ?? b.provider}` : ""}</span>
        </div>
        <div className="termin-btns">
          <NaviButton address={dest.address} className="termin-btn" />
          {tel && <a className="termin-btn" href={tel}>📞 Anrufen</a>}
          {wa && <a className="termin-btn" href={wa} target="_blank" rel="noreferrer">💬 WhatsApp</a>}
          <Link className="termin-btn" href={`/verwaltung/nachrichten/${b.userId}`}>✉️ Chat</Link>
        </div>
      </section>

      <section className="card termin-card">
        <h2>Treffpunkt</h2>
        <p style={{ margin: 0 }}><strong>{dest.label}</strong><br />{dest.address}</p>
        {b.studentNote && <blockquote className="note">„{b.studentNote}“</blockquote>}
      </section>

      <section className="card termin-card">
        <div className="termin-student">
          <Avatar id={b.userId} name={b.userName ?? "?"} photoAt={det.photoAt} size={64} />
          <div>
            <h2 style={{ margin: 0 }}>{b.userName}</h2>
            <span className="hint">{t ? CLASS_LABEL[t.profile.licenseClass] : "Klasse fehlt"}{t ? ` · ${t.state.current?.title ?? "fertig"} · ${t.state.percent} %` : ""}</span>
          </div>
        </div>
        <dl className="termin-dl">
          {b.userPhone && <><dt>Telefon</dt><dd><a href={tel!}>{b.userPhone}</a></dd></>}
          <dt>E-Mail</dt><dd><a href={`mailto:${b.userEmail}`}>{b.userEmail}</a></dd>
          {addressLine(det) && <><dt>Adresse</dt><dd>{addressLine(det)}</dd></>}
          {age !== null && <><dt>Alter</dt><dd>{age} Jahre</dd></>}
          <dt>Guthaben</dt><dd>{formatPrice(creditBalance(d, b.userId))}</dd>
          {t && <><dt>Gefahren</dt><dd>{(t.records.filter((r) => r.status === "done").reduce((a, r) => a + r.minutes, 0) / 60).toFixed(1).replace(".", ",")} Std.</dd></>}
        </dl>
        <Link className="btn btn-secondary btn-small" href={`/verwaltung/schueler/${b.userId}`}>Schülerakte öffnen</Link>
      </section>

      <section className="card termin-card">
        <h2>Aktionen</h2>
        <div className="termin-actions">
          {b.status === "requested" && <Link className="btn btn-gold btn-small" href="/verwaltung/kalender?ansicht=woche#anfragen">Anfrage annehmen/ablehnen</Link>}
          {b.status === "awaiting_payment" && (
            <form action={markPaidCashAction}><input type="hidden" name="bookingId" value={b.id} /><button className="btn btn-gold btn-small" type="submit">Bar/EC bezahlt</button></form>
          )}
          {rec ? (
            <form action={recordStatusAction} className="row">
              <input type="hidden" name="userId" value={b.userId} /><input type="hidden" name="recordId" value={rec.id} />
              <span>Eingetragen als: <strong>{REC[rec.status] ?? rec.status}</strong></span>
              {rec.status !== "done" && <button className="btn btn-secondary btn-small" name="status" value="done" type="submit">✓ gefahren</button>}
              {rec.status !== "no_show" && <button className="btn btn-secondary btn-small" name="status" value="no_show" type="submit">nicht erschienen</button>}
              {rec.status !== "late" && <button className="btn btn-secondary btn-small" name="status" value="late" type="submit">zu spät</button>}
            </form>
          ) : b.endsAt < now ? <span className="hint">Wird nach der Fahrt automatisch als „gefahren“ eingetragen (bei bezahlten Fahrten).</span> : null}
          {b.startsAt > now && b.status !== "requested" && <CancelForm bookingId={b.id} templates={cancelT} paid={b.status === "paid"} />}
        </div>
      </section>
    </div>
  );
}
