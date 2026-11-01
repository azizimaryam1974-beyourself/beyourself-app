import Link from "next/link";
import { requireTeacher } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { buildDashboard, CATEGORY_LABEL, IDLE_DAYS, type WeekBar } from "@/lib/server/dashboard";
import { runBookingJobs } from "@/lib/server/payments/service";
import { formatPrice } from "@/lib/language-package";
import { dayKey, fmtDay, fmtDayShort, fmtTime } from "@/lib/time";
import { getWeather, WEATHER_EMOJI } from "@/lib/server/weather";
import { darkStart, sunsetMs } from "@/lib/calendar";

export const dynamic = "force-dynamic";
export const metadata = { title: "Übersicht" };

const euro = (c: number) => formatPrice(c).replace(",00", "");
const hm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const firstName = (n: string) => n.split(" ")[0];
const initials = (n: string) => n.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
function waLink(phone: string | null): string | null {
  if (!phone) return null;
  let d = phone.replace(/[^\d+]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  else if (d.startsWith("00")) d = d.slice(2);
  else if (d.startsWith("0")) d = `49${d.slice(1)}`;
  return d.length >= 8 ? `https://wa.me/${d}` : null;
}

/** Weiche Kurve ohne Überschwingen (monotone kubische Interpolation) – fällt nie unter 0. */
function smooth(pts: Array<[number, number]>): string {
  const n = pts.length;
  if (n < 2) return "";
  const dx = pts.slice(1).map((p, i) => p[0] - pts[i][0]);
  const m = pts.slice(1).map((p, i) => (p[1] - pts[i][1]) / dx[i]);
  const t = pts.map((_, i) => (i === 0 ? m[0] : i === n - 1 ? m[n - 2] : m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2));
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
    const a = t[i] / m[i], b = t[i + 1] / m[i], h = a * a + b * b;
    if (h > 9) { const k = 3 / Math.sqrt(h); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i]; }
  }
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += ` C${(pts[i][0] + h).toFixed(1)},${(pts[i][1] + t[i] * h).toFixed(1)} ${(pts[i + 1][0] - h).toFixed(1)},${(pts[i + 1][1] - t[i + 1] * h).toFixed(1)} ${pts[i + 1][0]},${pts[i + 1][1]}`;
  }
  return d;
}

function RevenueChart({ weeks }: { weeks: WeekBar[] }) {
  const W = 640, H = 210, padX = 18, padTop = 26, padBottom = 28;
  const max = Math.max(1, ...weeks.map((w) => w.school + w.tuev));
  const x = (i: number) => padX + (i * (W - 2 * padX)) / (weeks.length - 1);
  const y = (v: number) => padTop + (H - padTop - padBottom) * (1 - v / max);
  const past = weeks.map((w, i) => [x(i), y(w.school)] as [number, number]);
  const split = weeks.findIndex((w) => w.future);
  const lastPast = split === -1 ? weeks.length - 1 : split - 1;
  const solid = smooth(past.slice(0, lastPast + 1));
  const dashed = split === -1 ? "" : smooth(past.slice(lastPast));
  const tuev = smooth(weeks.slice(0, lastPast + 1).map((w, i) => [x(i), y(w.tuev)] as [number, number]));
  const best = weeks.slice(0, lastPast + 1).reduce((b, w, i) => (w.school > weeks[b].school ? i : b), 0);
  const area = solid ? `${solid} L${x(lastPast)},${H - padBottom} L${x(0)},${H - padBottom} Z` : "";
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="dash-chart" role="img" aria-label="Einnahmen pro Woche">
      <defs>
        <linearGradient id="dash-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d99a3e" stopOpacity="0.28" />
          <stop offset="1" stopColor="#d99a3e" stopOpacity="0" />
        </linearGradient>
      </defs>
      {area && <path d={area} fill="url(#dash-area)" />}
      {tuev && <path d={tuev} fill="none" stroke="#f6f0e6" strokeOpacity="0.55" strokeWidth="2" />}
      {solid && <path d={solid} fill="none" stroke="#e0a24a" strokeWidth="3" strokeLinecap="round" />}
      {dashed && <path d={dashed} fill="none" stroke="#f6f0e6" strokeOpacity="0.8" strokeWidth="2.5" strokeDasharray="2 7" strokeLinecap="round" />}
      {weeks[best].school > 0 && (
        <g>
          <circle cx={x(best)} cy={y(weeks[best].school)} r="6" fill="#fff" stroke="#e0a24a" strokeWidth="3" />
          <rect x={x(best) - 38} y={y(weeks[best].school) - 34} width="76" height="22" rx="7" fill="rgba(15,26,44,.85)" stroke="rgba(233,215,180,.3)" />
          <text x={x(best)} y={y(weeks[best].school) - 19} textAnchor="middle" fontSize="12" fill="#f6f0e6">{euro(weeks[best].school)}</text>
        </g>
      )}
      {weeks.map((w, i) => (i % 2 === 1 || i === weeks.length - 1) && (
        <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize="12" fill="rgba(246,240,230,.6)">{w.label}</text>
      ))}
    </svg>
  );
}

function Donut({ pct }: { pct: number }) {
  const r = 38, c = 2 * Math.PI * r, v = Math.min(100, Math.max(0, pct));
  return (
    <svg viewBox="0 0 100 100" className="dash-donut" role="img" aria-label={`${v} Prozent gebucht`}>
      <circle cx="50" cy="50" r={r} fill="#f6f0e6" />
      <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(15,26,44,.12)" strokeWidth="9" />
      <circle cx="50" cy="50" r={r} fill="none" stroke="#e0a24a" strokeWidth="9" strokeLinecap="round"
        strokeDasharray={`${(v / 100) * c} ${c}`} transform="rotate(-90 50 50)" />
      <text x="50" y="56" textAnchor="middle" fontSize="18" fontWeight="700" fill="#0f1a2c">{v}%</text>
    </svg>
  );
}

const Icon = {
  people: <svg viewBox="0 0 24 24"><path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7 1a3 3 0 1 0 0-6M3 21c0-3.3 2.7-6 6-6s6 2.7 6 6m2-6c2.5.3 4 2.5 4 5" /></svg>,
  euro: <svg viewBox="0 0 24 24"><path d="M17 6.5A7 7 0 1 0 17 17.5M4 10h9M4 14h9" /></svg>,
  clock: <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>,
  gauge: <svg viewBox="0 0 24 24"><path d="M4 18a8 8 0 1 1 16 0M12 18l4-6" /></svg>,
  cal: <svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>,
  live: <svg viewBox="0 0 24 24"><rect x="3" y="6" width="13" height="12" rx="3" /><path d="m16 10 5-3v10l-5-3" /></svg>,
  gear: <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2" /></svg>,
  phone: <svg viewBox="0 0 24 24"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" /></svg>,
  chat: <svg viewBox="0 0 24 24"><path d="M4 20l1.5-4A8 8 0 1 1 9 19.5Z" /></svg>,
  receipt: <svg viewBox="0 0 24 24"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2ZM9 8h6M9 12h6M9 16h3" /></svg>,
  bell: <svg viewBox="0 0 24 24"><path d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4ZM10 20a2 2 0 0 0 4 0" /></svg>,
};

export default async function DashboardPage() {
  const me = await requireTeacher();
  await runBookingJobs();
  const now = Date.now();
  const d = buildDashboard(db(), now);
  const weather = await getWeather(now);
  const today = dayKey(now);
  const sunset = sunsetMs(today), dark = darkStart(today);
  const k = d.kpi;
  const diff = k.revenuePrev ? Math.round(((k.revenueMonth - k.revenuePrev) / k.revenuePrev) * 100) : null;
  const drives = d.today.filter((t) => !t.private);
  const nowDrive = drives.find((t) => t.now) ?? drives.find((t) => t.start > now) ?? null;
  const total = d.phases.reduce((a, p) => a + p.count, 0) || 1;
  const hour = Number(new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "numeric" }).format(now));
  const greet = hour < 11 ? "Guten Morgen" : hour < 18 ? "Hallo" : "Guten Abend";

  return (
    <div className="dash">
      <div className="dash-main">
        <div className="dash-head">
          <h1>{greet}, {firstName(me.name)}</h1>
          <span className="hint">{fmtDay(now)}</span>
        </div>

        <div className="dash-kpis">
          <div className="dash-kpi"><span className="dash-ico">{Icon.people}</span><div><small>In Ausbildung</small><strong>{k.students}</strong>{k.newStudents > 0 && <em>+{k.newStudents} neu (30 Tage)</em>}</div></div>
          <div className="dash-kpi"><span className="dash-ico">{Icon.euro}</span><div><small>Einnahmen {new Intl.DateTimeFormat("de-DE", { month: "long" }).format(now)}</small><strong>{euro(k.revenueMonth)}</strong>
            <em>mit TÜV: {euro(k.revenueMonth + k.tuevMonth)}</em>
            {diff !== null && <em className={diff >= 0 ? "up" : "down"}>{diff >= 0 ? "▲" : "▼"} {Math.abs(diff)} % zum Vormonat</em>}</div></div>
          <div className="dash-kpi"><span className="dash-ico">{Icon.clock}</span><div><small>Offene Zahlungen</small><strong>{euro(k.openPayments)}</strong><em>{k.openCount} offen</em></div></div>
          <div className="dash-kpi"><span className="dash-ico">{Icon.gauge}</span><div><small>Diese Woche gebucht</small><strong>{k.utilization} %</strong><em>{Math.round(k.bookedMin / 60)} von {Math.round(k.workMin / 60)} Std.</em></div></div>
        </div>

        <section className="dash-card">
          <div className="dash-card-head">
            <div><h2>Einnahmen</h2><p className="hint">Eingegangenes Geld pro Woche · gestrichelt: schon bezahlte Termine der nächsten Wochen</p></div>
            <div className="dash-legend">
              <span><i style={{ background: "#e0a24a" }} /> Fahrschule</span>
              <span><i style={{ background: "#f6f0e6" }} /> TÜV (durchlaufend)</span>
            </div>
          </div>
          <RevenueChart weeks={d.weeks} />
          <div className="dash-cats">
            {d.byCategory.length === 0 ? <span className="hint">Diesen Monat noch keine Einnahmen.</span> : d.byCategory.map((c) => (
              <span key={c.cat}><small>{CATEGORY_LABEL[c.cat]}</small><strong>{euro(c.cents)}</strong></span>
            ))}
            {k.tuevMonth > 0 && <span className="muted"><small>TÜV-Gebühren (weiterleiten)</small><strong>{euro(k.tuevMonth)}</strong></span>}
          </div>
        </section>

        <div className="dash-row">
          <section className="dash-card">
            <h2>Wo stehen meine Schüler</h2>
            <div className="dash-goals">
              {d.phases.length === 0 ? <p className="hint">Noch keine Schüler.</p> : d.phases.map((p) => {
                const pct = Math.round((p.count / total) * 100);
                return (
                  <div key={p.id} className="dash-goal">
                    <strong>{p.count}</strong>
                    <div className="dash-bar"><span style={{ width: `${pct}%` }} /></div>
                    <small>{p.title}</small>
                  </div>
                );
              })}
            </div>
          </section>
          <section className="dash-card dash-util">
            <h2>Auslastung</h2>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center", flexWrap: "nowrap" }}>
              <div>
                <small className="hint">Gebucht diese Woche</small>
                <div className="dash-big">{Math.round(k.bookedMin / 60)} Std.</div>
                <div className="dash-bar wide"><span style={{ width: `${Math.min(100, k.utilization)}%` }} /></div>
                <small className="hint">von {Math.round(k.workMin / 60)} Std. Arbeitszeit</small>
              </div>
              <Donut pct={k.utilization} />
            </div>
          </section>
        </div>
      </div>

      <aside className="dash-side">
        <section className="dash-card dash-profile">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <Link href="/termine" className="dash-bell" aria-label="Nachrichten">{Icon.bell}{d.todo.length > 0 && <i />}</Link>
            <span className="hint">Fahrlehrerin</span>
          </div>
          <div className="dash-avatar">{initials(me.name)}</div>
          <div className="dash-name">{me.name}</div>
          <div className="dash-actions">
            <Link href="/verwaltung/kalender"><span>{Icon.cal}</span>Kalender</Link>
            <Link href="/verwaltung"><span>{Icon.people}</span>Schüler</Link>
            <Link href="/unterricht"><span>{Icon.live}</span>Theorie</Link>
            <Link href="/verwaltung/belege"><span>{Icon.receipt}</span>Beleg</Link>
          </div>
          <div className="dash-gold">
            {nowDrive ? (
              <>
                <small>{nowDrive.now ? "Jetzt unterwegs mit" : "Nächste Fahrt heute"}</small>
                <div className="dash-gold-name">{nowDrive.userName}</div>
                <div className="dash-gold-row"><span>{fmtTime(nowDrive.start)}–{fmtTime(nowDrive.end)} Uhr</span><strong>{nowDrive.title.split(" · ")[0]}</strong></div>
                {nowDrive.meeting && <small>{nowDrive.meeting}</small>}
              </>
            ) : (
              <>
                <small>Heute</small>
                <div className="dash-gold-name">Keine weiteren Fahrten</div>
                <div className="dash-gold-row"><span>{drives.length} {drives.length === 1 ? "Fahrt" : "Fahrten"} heute</span><strong>frei</strong></div>
              </>
            )}
          </div>
        </section>

        <section className="dash-card dash-weather">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h2 style={{ margin: 0 }}>Wetter Kassel</h2>
            {weather?.now && <span className="dash-wnow">{WEATHER_EMOJI[weather.now.icon] ?? "☁️"} {weather.now.temp}°</span>}
          </div>
          <div className="dash-sun">🌅 Sonnenuntergang <strong>{fmtTime(sunset)}</strong> · Beleuchtungsfahrt ab <strong>{fmtTime(dark)}</strong></div>
          {weather ? (
            <>
              {weather.alerts.map((a, i) => <div key={i} className="dash-alert">⚠️ {a.headline}</div>)}
              <ul className="dash-wdays">
                {weather.days.map((w) => (
                  <li key={w.day}>
                    <span className="dash-wico">{WEATHER_EMOJI[w.icon] ?? "☁️"}</span>
                    <div>
                      <strong>{w.day === today ? "Heute" : fmtDayShort(new Date(`${w.day}T12:00:00Z`).getTime())}</strong>
                      <small>{w.min}° / {w.max}°{w.rainMm > 0 ? ` · ${String(w.rainMm).replace(".", ",")} mm` : ""}{w.gustMax >= 40 ? ` · Böen ${w.gustMax} km/h` : ""}</small>
                      {w.hints.length > 0 && <small className="dash-whint">{w.hints.join(" · ")}</small>}
                    </div>
                  </li>
                ))}
              </ul>
            </>
          ) : <p className="hint">Wetterdaten gerade nicht erreichbar.</p>}
          <small className="hint">Daten: Deutscher Wetterdienst</small>
        </section>

        <section className="dash-card">
          <h2>Heute</h2>
          {d.today.length === 0 ? <p className="hint">Heute keine Fahrten und keine privaten Termine.</p> : (
            <ul className="dash-list">
              {d.today.map((t, i) => (
                <li key={i} className={`${t.now ? "on" : t.end < now ? "past" : ""} ${t.private ? "private" : ""}`}>
                  <span className="dash-av">{t.private ? "🔒" : initials(t.userName)}</span>
                  <div><strong>{t.private ? t.title : t.userName}</strong><small>{t.private ? `Privat · bis ${fmtTime(t.end)} Uhr – sehen Schüler nicht` : t.title}</small></div>
                  <span className="dash-time">{fmtTime(t.start)}</span>
                </li>
              ))}
            </ul>
          )}
          <Link className="dash-more" href="/verwaltung/kalender">Ganzer Kalender <span>→</span></Link>
        </section>
      </aside>

      <section className="dash-card dash-wide">
        <h2>Wartet auf dich {d.todo.length > 0 && <span className="tab-count">{d.todo.length}</span>}</h2>
        {d.todo.length === 0 ? <p className="hint">Alles erledigt. 🎉</p> : (
          <ul className="dash-todo">
            {d.todo.map((t, i) => (
              <li key={i}><div>{t.userName && <strong>{t.userName}: </strong>}{t.text}</div><Link className="btn btn-small btn-secondary" href={t.href}>Öffnen</Link></li>
            ))}
          </ul>
        )}
      </section>

      <section className="dash-card dash-wide">
        <h2>Lohnt sich anzurufen</h2>
        <p className="hint">Schüler, bei denen es stockt – z. B. seit {IDLE_DAYS} Tagen nichts gebucht. Ein kurzer Anruf hilft oft.</p>
        {d.calls.length === 0 ? <p className="hint">Gerade niemand.</p> : (
          <ul className="dash-todo">
            {d.calls.map((c) => {
              const wa = waLink(c.phone);
              return (
                <li key={c.userId}>
                  <div><Link href={`/verwaltung/schueler/${c.userId}`}><strong>{c.name}</strong></Link><div className="hint">{c.reason}</div></div>
                  <div className="row" style={{ flexWrap: "nowrap" }}>
                    {c.phone && <a className="dash-round" href={`tel:${c.phone}`} aria-label={`${c.name} anrufen`}>{Icon.phone}</a>}
                    {wa && <a className="dash-round" href={wa} target="_blank" rel="noreferrer" aria-label={`WhatsApp an ${c.name}`}>{Icon.chat}</a>}
                    {!c.phone && <span className="hint">keine Telefonnummer</span>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="dash-card">
        <h2>Nächste Prüfungen</h2>
        {d.exams.length === 0 ? <p className="hint">Keine Prüfungen geplant.</p> : (
          <ul className="dash-list">
            {d.exams.map((e) => (
              <li key={e.id}>
                <span className="dash-av">{initials(e.name)}</span>
                <div><Link href={`/verwaltung/schueler/${e.userId}#pruefungen`}><strong>{e.name}</strong></Link><small>{e.type === "praxis" ? "Praxis" : "Theorie"} · {e.status === "confirmed" ? "bestätigt" : "wartet auf Bestätigung"}</small></div>
                <span className="dash-time">{fmtDayShort(e.startsAt)}<br />{fmtTime(e.startsAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="dash-card">
        <h2>Warteliste</h2>
        {d.waitlist.length === 0 ? <p className="hint">Niemand auf der Warteliste.</p> : (
          <ul className="dash-list">
            {d.waitlist.map((w, i) => (
              <li key={i}>
                <span className="dash-av">{initials(w.name)}</span>
                <div><strong>{w.name}</strong><small>{hm(w.fromMin)}–{hm(w.toMin)} Uhr</small></div>
                <span className="dash-time">{fmtDayShort(new Date(`${w.day}T12:00:00Z`).getTime())}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
