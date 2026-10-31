"use client";

import { useActionState, useState } from "react";
import { addBlockAction, saveWorkHoursAction, type ActionState } from "@/app/calendar-actions";
import { FormMessage } from "@/components/booking/FormMessage";

const DAYS = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export function WorkHoursForm({ template }: { template: Array<Array<{ from: number; to: number }>> }) {
  const [state, action, pending] = useActionState(saveWorkHoursAction, {} as ActionState);
  const [rows, setRows] = useState(() => template.map((d) => Math.max(1, d.length)));
  return (
    <form action={action}>
      <div className="wh-grid">
        {DAYS.map((name, wd) => (
          <fieldset key={wd} className="wh-day">
            <legend>{name}</legend>
            {Array.from({ length: rows[wd] }, (_, i) => {
              const r = template[wd][i];
              return (
                <div key={i} className="wh-range">
                  <input type="time" step={900} name={`d${wd}f${i}`} defaultValue={r ? hhmm(r.from) : ""} aria-label={`${name} von`} />
                  <span>–</span>
                  <input type="time" step={900} name={`d${wd}t${i}`} defaultValue={r ? hhmm(r.to) : ""} aria-label={`${name} bis`} />
                </div>
              );
            })}
            <div className="row">
              {rows[wd] < 3 && <button type="button" className="link-btn" onClick={() => setRows((x) => x.map((n, j) => (j === wd ? n + 1 : n)))}>+ Zeitraum (z. B. nach der Pause)</button>}
            </div>
            {template[wd].length === 0 && rows[wd] === 1 && <p className="hint" style={{ margin: 0 }}>frei – leer lassen</p>}
          </fieldset>
        ))}
      </div>
      <p className="hint">Leere Felder = an diesem Tag keine Fahrten. Pausen entstehen durch zwei Zeiträume (z. B. 09:00–13:00 und 14:00–19:00).
        Außerhalb des Rahmens (Okt–Apr 9–21 Uhr, Mai–Sep 9–23 Uhr), an Sonntagen und Feiertagen in Hessen wird automatisch nichts angeboten.</p>
      <FormMessage state={state} />
      <button className="btn btn-gold" type="submit" disabled={pending}>Arbeitszeiten speichern</button>
    </form>
  );
}

export function BlockForm({ today }: { today: string }) {
  const [state, action, pending] = useActionState(addBlockAction, {} as ActionState);
  return (
    <form action={action} className="akte-form">
      <div className="row">
        <div className="field" style={{ margin: 0 }}><label htmlFor="bf">Von (Tag)</label><input id="bf" type="date" name="fromDay" defaultValue={today} min={today} required /></div>
        <div className="field" style={{ margin: 0 }}><label htmlFor="bft">ab Uhrzeit <span className="hint">(leer = ganzer Tag)</span></label><input id="bft" type="time" step={900} name="fromTime" /></div>
      </div>
      <div className="row">
        <div className="field" style={{ margin: 0 }}><label htmlFor="bt">Bis (Tag)</label><input id="bt" type="date" name="toDay" min={today} /></div>
        <div className="field" style={{ margin: 0 }}><label htmlFor="btt">bis Uhrzeit <span className="hint">(leer = Tagesende)</span></label><input id="btt" type="time" step={900} name="toTime" /></div>
      </div>
      <input type="text" name="note" maxLength={200} placeholder="Grund (nur für dich), z. B. Urlaub, Arzt, Prüfungen beim TÜV" aria-label="Grund" />
      <FormMessage state={state} />
      <button className="btn btn-secondary btn-small" type="submit" disabled={pending}>Zeit sperren</button>
    </form>
  );
}
