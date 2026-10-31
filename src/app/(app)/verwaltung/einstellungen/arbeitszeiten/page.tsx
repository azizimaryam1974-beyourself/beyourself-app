import { requireTeacher } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { getTemplate, listBlocks, mainTeacherId } from "@/lib/server/drive-booking";
import { deleteBlockAction } from "@/app/calendar-actions";
import { hessenHolidays } from "@/lib/calendar";
import { dayKey, fmtDate, fmtDay, fmtTime, keyToNoonMs } from "@/lib/time";
import { PageHead } from "@/components/PageHead";
import { BlockForm, WorkHoursForm } from "./Forms";

export const metadata = { title: "Arbeitszeiten" };
export const dynamic = "force-dynamic";

export default async function WorkHoursPage() {
  await requireTeacher();
  const d = db();
  const tid = mainTeacherId(d)!;
  const now = Date.now();
  const blocks = listBlocks(d, now, now + 400 * 86_400_000);
  const year = Number(dayKey(now).slice(0, 4));
  const today = dayKey(now);
  const holidays = [...hessenHolidays(year), ...hessenHolidays(year + 1)].filter(([k]) => k >= today).slice(0, 8);
  const has = d.prepare(`SELECT 1 FROM settings WHERE key = ?`).get(`template_set:${tid}`);

  return (
    <>
      <PageHead title="Arbeitszeiten & Urlaub" back={{ href: "/verwaltung/einstellungen", label: "Einstellungen" }}
        intro="Deine normale Woche. Einzelne Tage änderst du jederzeit direkt im Kalender (Stunde antippen oder „Tag anpassen“)." />
      <section className="card">
        <h2>Deine normale Woche</h2>
        {!has && <div className="alert alert-info">Das ist ein <strong>Vorschlag</strong>. Bitte trag deine echten Zeiten ein und speichere.</div>}
        {getTemplate(d, tid).some((r) => r.some((x) => x.from < 540)) && (
          <div className="alert alert-info">Achtung: Bei mindestens einem Tag beginnt deine Zeit <strong>vor 9 Uhr</strong>. Dein Arbeitsrahmen beginnt um 9 Uhr – die Zeit davor wird Schülern nicht angeboten.</div>
        )}
        <WorkHoursForm template={getTemplate(d, tid)} />
      </section>

      <section className="card">
        <h2>Urlaub & freie Zeiten</h2>
        <p className="hint">Urlaub, Termine, Prüfungstage: In diesen Zeiten können Schüler nichts buchen. Einzelne Tage sperrst du auch direkt im Kalender.</p>
        <BlockForm today={today} />
        {blocks.length > 0 && (
          <ul className="list" style={{ marginTop: 14 }}>
            {blocks.map((b) => (
              <li key={b.id}>
                <span>
                  <strong>{dayKey(b.startsAt) === dayKey(b.endsAt - 1) ? fmtDay(b.startsAt) : `${fmtDate(b.startsAt)} – ${fmtDate(b.endsAt - 1)}`}</strong>
                  {" · "}{fmtTime(b.startsAt)}–{fmtTime(b.endsAt) === "00:00" ? "24:00" : fmtTime(b.endsAt)}
                  {b.note && <span className="hint"> · {b.note}</span>}
                </span>
                <form action={deleteBlockAction}><input type="hidden" name="id" value={b.id} /><button className="link-btn" type="submit">aufheben</button></form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2>Feiertage Hessen (automatisch gesperrt)</h2>
        <ul className="list">
          {holidays.map(([k, name]) => <li key={k}><span>{fmtDay(keyToNoonMs(k))}</span><span className="hint">{name}</span></li>)}
        </ul>
      </section>
    </>
  );
}
