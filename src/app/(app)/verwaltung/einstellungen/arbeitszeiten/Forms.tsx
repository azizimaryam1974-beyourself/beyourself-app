"use client";

import { useActionState, useState } from "react";
import { addBlockAction, saveWorkHoursAction, type ActionState } from "@/app/calendar-actions";
import { FormMessage } from "@/components/booking/FormMessage";

const DAYS = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export function WorkHoursForm({ template }: { template: Array<Array<{ from: number; to: number }>> }) {
  const [state, action, pending] = useActionState(saveWorkHoursAction, {} as ActionState);
  type R = { from: string; to: string };
  const [days, setDays] = useState<R[][]>(() => template.map((d) => d.map((r) => ({ from: hhmm(r.from), to: hhmm(r.to) }))));
  const set = (wd: number, fn: (rs: R[]) => R[]) => setDays((all) => all.map((rs, j) => (j === wd ? fn(rs) : rs)));
  return (
    <form action={action}>
      <div className="wh-grid">
        {DAYS.map((name, wd) => (
          <fieldset key={wd} className="wh-day">
            <legend>{name}</legend>
            {days[wd].map((r, i) => (
              <div key={i} className="wh-range">
                <input type="time" step={900} name={`d${wd}f${i}`} value={r.from} onChange={(e) => set(wd, (rs) => rs.map((x, k) => (k === i ? { ...x, from: e.target.value } : x)))} aria-label={`${name} von`} />
                <span>–</span>
                <input type="time" step={900} name={`d${wd}t${i}`} value={r.to} onChange={(e) => set(wd, (rs) => rs.map((x, k) => (k === i ? { ...x, to: e.target.value } : x)))} aria-label={`${name} bis`} />
                <button type="button" className="wh-del" onClick={() => set(wd, (rs) => rs.filter((_, k) => k !== i))} aria-label={`${name}: diesen Zeitraum löschen`} title="Zeitraum löschen">✕</button>
              </div>
            ))}
            {days[wd].length === 0 && <p className="hint" style={{ margin: "4px 0" }}>frei – an diesem Tag keine Fahrten</p>}
            <div className="row">
              {days[wd].length < 3 && (
                <button type="button" className="link-btn" onClick={() => set(wd, (rs) => [...rs, { from: rs.length ? "" : "09:00", to: rs.length ? "" : "17:00" }])}>
                  + Zeitraum{days[wd].length ? " (z. B. nach der Pause)" : ""}
                </button>
              )}
            </div>
          </fieldset>
        ))}
      </div>
      <p className="hint">Mit ✕ löschst du einen Zeitraum. Ein Tag ohne Zeitraum = an diesem Tag keine Fahrten. Pausen entstehen durch zwei Zeiträume (z. B. 09:00–13:00 und 14:00–19:00).
        Außerhalb des Rahmens (Okt–Apr 9–21 Uhr, Mai–Sep 9–23 Uhr), an Sonntagen und Feiertagen in Hessen wird automatisch nichts angeboten. Erst „Speichern“ übernimmt die Änderung.</p>
      <FormMessage state={state} />
      <button className="btn btn-gold" type="submit" disabled={pending}>Arbeitszeiten speichern</button>
    </form>
  );
}

export function BlockForm({ today, privateMode = false }: { today: string; privateMode?: boolean }) {
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
      <input type="text" name="note" maxLength={200} required={privateMode}
        placeholder={privateMode ? "Was? z. B. Zahnarzt, Elternabend – sehen nur Sie, Schüler sehen nur „belegt“" : "Grund (nur für dich), z. B. Urlaub, Arzt, Prüfungen beim TÜV"} aria-label="Grund" />
      <FormMessage state={state} />
      <button className="btn btn-secondary btn-small" type="submit" disabled={pending}>{privateMode ? "Privaten Termin eintragen" : "Zeit sperren"}</button>
    </form>
  );
}
