import { blockDayAction, finishEarlyAction, saveDayAction } from "@/app/calendar-actions";

const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** Menü je Tag: früher Feierabend, eigene Zeiten für dieses Datum, Tag sperren. */
export function DayTools({ day, ranges, custom, week }: { day: string; ranges: Array<{ from: number; to: number }>; custom: boolean; week: string }) {
  const first = ranges[0]?.from ?? 540, last = ranges[ranges.length - 1]?.to ?? 1140;
  const ends: number[] = [];
  for (let m = first + 60; m < last; m += 30) ends.push(m);
  return (
    <details className="day-tools">
      <summary className="link-btn">Tag anpassen</summary>
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
        <form action={blockDayAction}>
          <input type="hidden" name="day" value={day} />
          <button className="btn btn-danger btn-small" type="submit">Ganzen Tag sperren</button>
        </form>
      </div>
    </details>
  );
}
