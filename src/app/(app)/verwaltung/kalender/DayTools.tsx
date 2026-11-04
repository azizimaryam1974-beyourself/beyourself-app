import { DetailsMenu } from "@/components/ui/Popover";
import { blockDayAction, finishEarlyAction, saveDayAction, shiftDayAction } from "@/app/calendar-actions";

const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** Menü je Tag: früher Feierabend, eigene Zeiten für dieses Datum, Tag sperren. */
export function DayTools({ day, ranges, custom, week, drives = [] }: { day: string; ranges: Array<{ from: number; to: number }>; custom: boolean; week: string; drives?: Array<{ min: number; name: string }> }) {
  const first = ranges[0]?.from ?? 540, last = ranges[ranges.length - 1]?.to ?? 1140;
  const ends: number[] = [];
  for (let m = first + 60; m < last; m += 30) ends.push(m);
  return (
    <DetailsMenu className="day-tools" summaryClass="link-btn" summary="Tag anpassen">
      <div className="day-tools-pop">
        {ends.length > 0 && (
          <form action={finishEarlyAction} className="row">
            <input type="hidden" name="day" value={day} /><input type="hidden" name="w" value={week} />
            <label htmlFor={`fe-${day}`} style={{ margin: 0 }}>Feierabend ab</label>
            <select id={`fe-${day}`} name="time" defaultValue={hhmm(ends[Math.max(0, ends.length - 2)])} style={{ width: "auto" }}>
              {ends.map((m) => <option key={m} value={hhmm(m)}>{hhmm(m)}</option>)}
            </select>
            <button className="btn btn-small" type="submit">OK</button>
          </form>
        )}
        <form action={saveDayAction} className="day-ranges">
          <input type="hidden" name="day" value={day} />
          <div className="hint">Zeiten nur für diesen Tag:</div>
          {[0, 1, 2].map((i) => (
            <div key={i} className="wh-range">
              <input type="time" step={900} name={`f${i}`} defaultValue={ranges[i] ? hhmm(ranges[i].from) : ""} aria-label="von" />
              <span>–</span>
              <input type="time" step={900} name={`t${i}`} defaultValue={ranges[i] ? hhmm(ranges[i].to) : ""} aria-label="bis" />
            </div>
          ))}
          <div className="row">
            <button className="btn btn-secondary btn-small" type="submit">Speichern</button>
            {custom && <button className="link-btn" type="submit" name="reset" value="1">wie Wochenvorlage</button>}
          </div>
        </form>
        {drives.length > 0 && (
          <form action={shiftDayAction} className="day-shift">
            <input type="hidden" name="day" value={day} /><input type="hidden" name="w" value={week} />
            <div className="hint"><strong>Termine verschieben</strong> – alle ab einer Uhrzeit gleichzeitig ({drives.length} an diesem Tag)</div>
            <div className="row">
              <label htmlFor={`sf-${day}`} style={{ margin: 0 }}>ab</label>
              <select id={`sf-${day}`} name="from" style={{ width: "auto" }} defaultValue={hhmm(drives[0].min)}>
                {drives.map((x) => <option key={x.min} value={hhmm(x.min)}>{hhmm(x.min)} · {x.name.split(" ")[0]}</option>)}
              </select>
              <label htmlFor={`sd-${day}`} style={{ margin: 0 }}>um</label>
              <select id={`sd-${day}`} name="delta" style={{ width: "auto" }} defaultValue="30">
                {[15, 30, 45, 60, 90, 120].map((m) => <option key={m} value={m}>+{m} Min später</option>)}
                {[15, 30, 60].map((m) => <option key={-m} value={-m}>−{m} Min früher</option>)}
              </select>
            </div>
            <label className="check"><input type="checkbox" name="notify" defaultChecked /> <span>Alle betroffenen Schüler benachrichtigen (Chat + Mitteilung + E-Mail)</span></label>
            <textarea name="text" rows={3} maxLength={1000} aria-label="Nachricht"
              defaultValue={"Hallo {name}, es tut mir leid – ich muss deinen Termin um {minuten} Minuten verschieben. Neu: {neu} Uhr statt {alt} Uhr. Wenn das nicht passt, schreib mir bitte kurz. Maryam"} />
            <div className="hint">{"{name}"}, {"{alt}"}, {"{neu}"} und {"{minuten}"} werden für jeden Schüler automatisch ersetzt. Prüfungen werden nicht verschoben.</div>
            <button className="btn btn-small" type="submit">Verschieben</button>
          </form>
        )}
        <form action={blockDayAction}>
          <input type="hidden" name="day" value={day} />
          <button className="btn btn-danger btn-small" type="submit">Ganzen Tag sperren</button>
        </form>
      </div>
    </DetailsMenu>
  );
}
