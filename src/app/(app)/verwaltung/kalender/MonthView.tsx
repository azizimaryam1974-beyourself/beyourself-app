import Link from "next/link";
import { db } from "@/lib/server/db";
import { listBookingsByStatus } from "@/lib/server/booking";
import { dayEntries, destinationFor, monthGrid, type DayEntry } from "@/lib/server/calendar-month";
import { MEETING_POINTS } from "@/lib/server/drive-booking";
import { teacherBookDriveAction } from "@/app/teacher-drive-actions";
import { NaviButton } from "@/components/calendar/NaviButton";
import { Avatar } from "@/components/ui/Avatar";
import { detailsMap } from "@/lib/server/user-details";
import { getIcsToken } from "@/lib/server/ics";
import { createIcsTokenAction } from "@/app/ics-actions";
import { formatPrice } from "@/lib/language-package";
import { KIND_LABEL, DRIVE_KINDS } from "@/lib/training";
import { waLink, telLink } from "@/lib/phone";
import { dayKey, fmtTime, isDayKey } from "@/lib/time";
import { SCHOOL } from "@/lib/school";

const MONTHS = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
const WD = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const fmtLong = new Intl.DateTimeFormat("de-DE", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });
const KIND_CLS = (k: string | null) => (k === "ueberland" || k === "autobahn" || k === "beleuchtung" ? "k-sonder" : k === "testfahrt" || k === "warmstunde" || k === "pruefung" ? "k-pruef" : "k-uebung");
const STATUS: Record<string, [string, string]> = { requested: ["Anfrage", "badge-warn"], awaiting_payment: ["Zahlung offen", "badge-warn"], paid: ["bezahlt", "badge-ok"] };
const shiftMonth = (m: string, d: number) => { const [y, mo] = m.split("-").map(Number); const t = new Date(Date.UTC(y, mo - 1 + d, 1)); return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}`; };
const hm = (t: number) => fmtTime(t);

/** Neuer Kalender: Monat oben (Anzahl Termine je Tag), darunter die Liste des gewählten Tages. */
export function MonthView({ sp, now }: { sp: { m?: string; tag?: string; neu?: string; fehler?: string; ok?: string }; now: number }) {
  const d = db();
  const today = dayKey(now);
  const sel = isDayKey(sp.tag) ? sp.tag! : today;
  const month = /^\d{4}-\d{2}$/.test(sp.m ?? "") ? sp.m! : sel.slice(0, 7);
  const grid = monthGrid(d, month, now);
  const { entries, sunset } = dayEntries(d, sel, now);
  const drives = entries.filter((e): e is Extract<DayEntry, { type: "drive" }> => e.type === "drive");
  const next = sel === today ? drives.find((e) => e.end > now) : undefined;
  const requests = listBookingsByStatus(d, ["requested"]);
  const det = detailsMap(d);
  const students = d.prepare(`SELECT id, name FROM users WHERE role = 'student' ORDER BY name`).all() as Array<{ id: string; name: string }>;
  const neu = Number(sp.neu) || 0;
  const neuTime = neu > 1e12 ? hm(neu) : "";
  const ics = getIcsToken(d);
  const [y, mo] = month.split("-").map(Number);
  const link = (q: Record<string, string>) => `/verwaltung/kalender?${new URLSearchParams(q).toString()}`;

  return (
    <div className="mcal">
      <div className="mcal-head">
        <div>
          <h1 className="mcal-title">{MONTHS[mo - 1]} <span>{y}</span></h1>
        </div>
        <div className="mcal-nav">
          <Link className="mcal-arrow" href={link({ m: shiftMonth(month, -1), tag: `${shiftMonth(month, -1)}-01` })} aria-label="Vormonat">‹</Link>
          <Link className="mcal-today" href="/verwaltung/kalender">Heute</Link>
          <Link className="mcal-arrow" href={link({ m: shiftMonth(month, 1), tag: `${shiftMonth(month, 1)}-01` })} aria-label="Nächster Monat">›</Link>
        </div>
      </div>
      <div className="mcal-seg"><span className="on">Monat</span><Link href={`/verwaltung/kalender?ansicht=woche&w=${sel}`}>Woche (Zeitleiste)</Link></div>

      {sp.fehler && <div className="alert alert-error" role="alert">{sp.fehler}</div>}
      {sp.ok && <div className="alert alert-ok" role="status">{sp.ok}</div>}
      {requests.length > 0 && (
        <Link className="mcal-req" href={`/verwaltung/kalender?ansicht=woche#anfragen`}>🔔 {requests.length} {requests.length === 1 ? "Anfrage wartet" : "Anfragen warten"} auf deine Freigabe →</Link>
      )}

      <div className="mcal-grid" role="grid">
        {WD.map((w) => <div key={w} className="mcal-wd">{w}</div>)}
        {grid.map((c) => (
          <Link key={c.day} href={link({ m: month, tag: c.day })} className={`mcal-day ${c.inMonth ? "" : "out"} ${c.day === sel ? "sel" : ""} ${c.today ? "today" : ""} ${c.closed ? "closed" : ""}`} aria-label={`${c.day}: ${c.count} Termine`}>
            <span className="n">{Number(c.day.slice(8))}</span>
            {c.count > 0 ? <span className="cnt">{c.count}</span> : <span className="cnt empty" />}
          </Link>
        ))}
      </div>

      <div className="mcal-dayhead">
        <div>
          <h2>{fmtLong.format(new Date(`${sel}T12:00:00Z`))}</h2>
          <span className="hint">{drives.length} {drives.length === 1 ? "Termin" : "Termine"} · 🌅 Sonnenuntergang {hm(sunset)}</span>
        </div>
        <Link className="btn btn-gold btn-small" href={link({ m: month, tag: sel, neu: "1" }) + "#eintragen"}>+ Fahrt</Link>
      </div>

      {next && (
        <div className="mcal-next">
          <small>{next.start <= now ? "JETZT UNTERWEGS" : `ALS NÄCHSTES · IN ${Math.max(1, Math.round((next.start - now) / 60_000))} MIN`}</small>
          <strong>{next.b.userName}</strong>
          <div className="r"><span>{hm(next.start)}–{hm(next.end)} · {next.b.kind ? KIND_LABEL[next.b.kind as keyof typeof KIND_LABEL] : next.b.title}</span><span>{destinationFor(d, next.b).label}</span></div>
          <div className="mcal-next-btns">
            <NaviButton address={destinationFor(d, next.b).address} className="mcal-nbtn" />
            {telLink(next.b.userPhone) && <a className="mcal-nbtn" href={telLink(next.b.userPhone)!}>📞 Anrufen</a>}
            {waLink(next.b.userPhone) && <a className="mcal-nbtn" href={waLink(next.b.userPhone)!} target="_blank" rel="noreferrer">💬 WhatsApp</a>}
          </div>
        </div>
      )}

      <ul className="mcal-list">
        {entries.length === 0 && <li className="mcal-empty">{grid.find((c) => c.day === sel)?.closed ?? "Keine Termine und keine Arbeitszeit an diesem Tag."}</li>}
        {entries.map((e) => e.type === "drive" ? (
          <li key={e.id} className={`mcal-item ${KIND_CLS(e.b.kind)} ${e.end < now ? "past" : ""}`}>
            <div className="t"><b>{hm(e.start)}</b>{hm(e.end)}</div>
            <Avatar id={e.b.userId} name={e.b.userName ?? "?"} photoAt={det.get(e.b.userId)?.photoAt} size={38} />
            <Link className="mcal-main" href={`/verwaltung/kalender/termin/${e.b.id}`}>
              <strong>{e.b.userName}</strong>
              <span>{e.b.kind ? KIND_LABEL[e.b.kind as keyof typeof KIND_LABEL] : e.b.title} · {destinationFor(d, e.b).label}</span>
              <span className={`badge ${STATUS[e.b.status]?.[1] ?? ""}`}>{e.b.examId ? "Prüfung · " : ""}{STATUS[e.b.status]?.[0] ?? e.b.status}</span>
            </Link>
            <Link className="mcal-more" href={`/verwaltung/kalender/termin/${e.b.id}`} aria-label="Einzelheiten">⋯</Link>
          </li>
        ) : e.type === "private" ? (
          <li key={e.id} className="mcal-item k-privat">
            <div className="t"><b>{hm(e.start)}</b>{hm(e.end)}</div>
            <span className="mcal-lock">🔒</span>
            <div className="mcal-main"><strong>{e.note}</strong><span>privat – Schüler sehen nur „belegt“</span></div>
            <Link className="mcal-more" href={`/verwaltung/kalender?ansicht=woche&w=${sel}`} aria-label="In der Zeitleiste bearbeiten">⋯</Link>
          </li>
        ) : (
          <li key={e.id} className="mcal-item k-frei">
            <Link className="mcal-free" href={link({ m: month, tag: sel, neu: String(e.start) }) + "#eintragen"}>
              + {hm(e.start)}–{hm(e.end)} frei · Fahrt eintragen
            </Link>
          </li>
        ))}
      </ul>

      <details className="card mcal-book" id="eintragen" open={!!neu}>
        <summary><h2 style={{ display: "inline" }}>Fahrt selbst eintragen</h2> <span className="hint">– z. B. am Telefon vereinbart</span></summary>
        <form action={teacherBookDriveAction} className="mcal-form">
          <div className="field"><label htmlFor="tb-s">Schüler</label>
            <select id="tb-s" name="userId" required defaultValue=""><option value="" disabled>Schüler wählen …</option>{students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
          <div className="field-row">
            <div className="field" style={{ flex: "1 1 10em" }}><label htmlFor="tb-k">Art</label>
              <select id="tb-k" name="kind" defaultValue="automatik">{DRIVE_KINDS.filter((k) => k !== "pruefung").map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}</select></div>
            <div className="field" style={{ flex: "0 0 7.5em" }}><label htmlFor="tb-m">Dauer</label>
              <select id="tb-m" name="minutes" defaultValue="90">{[45, 60, 75, 90, 120, 135].map((m) => <option key={m} value={m}>{m} Min</option>)}</select></div>
          </div>
          <div className="field-row">
            <div className="field" style={{ flex: 1 }}><label htmlFor="tb-d">Tag</label><input id="tb-d" type="date" name="day" defaultValue={sel} min={today} required /></div>
            <div className="field" style={{ flex: 1 }}><label htmlFor="tb-t">Uhrzeit</label><input id="tb-t" type="time" name="time" step={900} defaultValue={neuTime || "09:00"} required /></div>
          </div>
          <div className="field"><label htmlFor="tb-mp">Treffpunkt</label>
            <select id="tb-mp" name="meeting">{MEETING_POINTS.map((m) => <option key={m} value={m}>{m}</option>)}</select></div>
          <input type="text" name="note" maxLength={300} placeholder="Notiz / Abholadresse (optional)" aria-label="Notiz" />
          <fieldset className="mcal-pay"><legend>Bezahlung</legend>
            <label className="check"><input type="radio" name="pay" value="offen" defaultChecked /> <span>Schüler zahlt bis zur Fahrt (online oder bar) – bekommt eine Nachricht</span></label>
            <label className="check"><input type="radio" name="pay" value="bar" /> <span>Schon bar/EC bezahlt</span></label>
            <label className="check"><input type="radio" name="pay" value="guthaben" /> <span>Vom Guthaben abbuchen</span></label>
          </fieldset>
          <button className="btn btn-gold" type="submit">Eintragen</button>
          <p className="hint" style={{ margin: 0 }}>Die Zeit muss in deiner Arbeitszeit liegen und frei sein. Phase, Wochen-Grenze und Vorlauf gelten hier nicht – du entscheidest.</p>
        </form>
      </details>

      <details className="card mcal-ics">
        <summary><h2 style={{ display: "inline" }}>📅 Im iPhone- oder Google-Kalender sehen</h2></summary>
        {ics ? (
          <>
            <p>Alle Fahrten und Prüfungen erscheinen automatisch in deinem Kalender auf dem Handy (aktualisiert sich von selbst, etwa jede Stunde). Private Termine stehen dort nur als „Privat“.</p>
            <p><strong>iPhone:</strong> Auf den Knopf tippen → „Abonnieren“.</p>
            <a className="btn btn-gold btn-small" href={`webcal://${SCHOOL.url.replace(/^https?:\/\//, "")}/api/kalender/${ics}`}>Im iPhone-Kalender abonnieren</a>
            <p className="hint">Google-Kalender (am PC): „Weitere Kalender“ → „Per URL“ → diese Adresse einfügen:</p>
            <input readOnly value={`${SCHOOL.url}/api/kalender/${ics}`} aria-label="Kalender-Adresse" />
            <form action={createIcsTokenAction}><button className="link-btn" type="submit">Neuen Link erstellen (alter Link funktioniert dann nicht mehr)</button></form>
          </>
        ) : (
          <form action={createIcsTokenAction}>
            <p>Erstellt einen geheimen Link nur für dich. Wer den Link hat, sieht deine Termine – also nicht weitergeben.</p>
            <button className="btn btn-gold btn-small" type="submit">Link erstellen</button>
          </form>
        )}
      </details>
      <p className="hint mcal-foot">Urlaub, Arbeitszeiten und Tag verschieben: <Link href={`/verwaltung/kalender?ansicht=woche&w=${sel}`}>Woche (Zeitleiste)</Link> · <Link href="/verwaltung/einstellungen/arbeitszeiten">Normale Woche & Urlaub</Link></p>
    </div>
  );
}
