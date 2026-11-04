"use client";

import { useActionState } from "react";
import { addRecordAction, saveTargetsAction, type ActionState } from "@/app/training-actions";
import { FormMessage } from "@/components/booking/FormMessage";

export function TargetsForm({ userId, isB197, practiceTarget, repeatTarget, maxPerWeek, manualApproval, blocked }: {
  userId: string; isB197: boolean; practiceTarget: number | null; repeatTarget: number; maxPerWeek: number; manualApproval: boolean; blocked: boolean;
}) {
  const [state, action, pending] = useActionState(saveTargetsAction, {} as ActionState);
  return (
    <form action={action} className="akte-form">
      <input type="hidden" name="userId" value={userId} />
      <div className="row">
        {!isB197 && (
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="pt">Übungsstunden (45 Min)</label>
            <input id="pt" type="number" name="practiceTarget" min={1} max={200} defaultValue={practiceTarget ?? ""} placeholder="noch offen" />
          </div>
        )}
        <div className="field" style={{ margin: 0 }}>
          <label htmlFor="rt">Wiederholung (mind. 3)</label>
          <input id="rt" type="number" name="repeatTarget" min={3} max={40} defaultValue={repeatTarget} />
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label htmlFor="mw">Max. Termine/Woche</label>
          <input id="mw" type="number" name="maxPerWeek" min={1} max={14} defaultValue={maxPerWeek} />
        </div>
      </div>
      <label className="check"><input type="checkbox" name="notify" defaultChecked /> <span>Schüler über geänderte Stundenzahl benachrichtigen</span></label>
      <textarea name="message" rows={2} maxLength={600} placeholder="Persönliche Nachricht dazu (optional), z. B.: Wir üben noch das Einparken." />
      <label className="check"><input type="checkbox" name="manualApproval" defaultChecked={manualApproval} />
        <span>Buchungen nur mit meiner Freigabe <span className="hint" style={{ display: "block" }}>Dauerhaft: Der Schüler kann Zeiten anfragen, du bestätigst sie.</span></span></label>
      <label className="check"><input type="checkbox" name="blocked" defaultChecked={blocked} />
        <span>Buchen vorübergehend pausieren <span className="hint" style={{ display: "block" }}>Der Schüler kann gar nichts buchen oder anfragen, bis du das wieder ausschaltest. Die Freigabe-Einstellung bleibt dabei gespeichert.</span></span></label>
      <FormMessage state={state} />
      <button className="btn btn-small" type="submit" disabled={pending}>Speichern</button>
    </form>
  );
}

export function AddRecordForm({ userId, kinds, today }: { userId: string; kinds: Array<{ value: string; label: string }>; today: string }) {
  const [state, action, pending] = useActionState(addRecordAction, {} as ActionState);
  return (
    <form action={action} className="akte-form">
      <input type="hidden" name="userId" value={userId} />
      <div className="row">
        <div className="field" style={{ margin: 0 }}>
          <label htmlFor="rk">Art</label>
          <select id="rk" name="kind">{kinds.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}</select>
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label htmlFor="ru">Dauer</label>
          <select id="ru" name="minutes" defaultValue="90">
            {[30, 45, 60, 75, 90, 135, 180].map((m) => <option key={m} value={m}>{m} Min</option>)}
          </select>
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label htmlFor="rd">Datum</label>
          <input id="rd" type="date" name="date" defaultValue={today} max={today} required />
        </div>
      </div>
      <input type="text" name="note" maxLength={300} placeholder="Notiz (optional)" aria-label="Notiz" />
      <FormMessage state={state} />
      <button className="btn btn-secondary btn-small" type="submit" disabled={pending}>Als gefahren eintragen</button>
    </form>
  );
}
