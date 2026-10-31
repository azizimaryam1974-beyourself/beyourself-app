"use client";

import { useActionState } from "react";
import { scheduleLessonAction, type ActionState } from "@/app/theory-actions";
import { FormMessage } from "@/components/booking/FormMessage";

export function ScheduleForm({ today }: { today: string }) {
  const [state, action, pending] = useActionState(scheduleLessonAction, {} as ActionState);
  return (
    <form action={action} className="akte-form">
      <div className="offer-grid">
        <div className="field"><label htmlFor="th-t">Thema</label><input id="th-t" type="text" name="title" placeholder="z. B. Lektion 5 – Vorfahrt" required maxLength={120} /></div>
        <div className="field"><label htmlFor="th-d">Datum</label><input id="th-d" type="date" name="date" min={today} defaultValue={today} required /></div>
        <div className="field"><label htmlFor="th-z">Beginn</label><input id="th-z" type="time" name="time" step={900} defaultValue="18:00" required /></div>
        <div className="field"><label htmlFor="th-l">Dauer (Min)</label><input id="th-l" type="number" name="duration" min={30} max={300} step={15} defaultValue={90} /></div>
        <div className="field"><label htmlFor="th-o">Ort</label><input id="th-o" type="text" name="place" defaultValue="Fahrschule, Rudolf-Schwander-Str. 9" maxLength={120} /></div>
        <div className="field"><label htmlFor="th-w">Jede Woche wiederholen (Anzahl)</label><input id="th-w" type="number" name="weeks" min={1} max={26} defaultValue={1} /></div>
      </div>
      <FormMessage state={state} />
      <button className="btn btn-gold btn-small" type="submit" disabled={pending}>Termin planen</button>
    </form>
  );
}
