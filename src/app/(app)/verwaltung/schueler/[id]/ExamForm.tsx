"use client";

import { useActionState, useState } from "react";
import { inviteExamAction, type ActionState } from "@/app/exam-actions";
import { FormMessage } from "@/components/booking/FormMessage";

/** Einladung zur Prüfung – Termin, den der TÜV bestätigt hat. */
export function ExamInviteForm({ userId, type, missing, today, places, priceText }: {
  userId: string; type: "theorie" | "praxis"; missing: string[]; today: string; places: string[]; priceText: string;
}) {
  const [state, action, pending] = useActionState(inviteExamAction, {} as ActionState);
  const [time, setTime] = useState(type === "praxis" ? "08:00" : "09:00");
  const warmDefault = (() => {
    const [h, m] = time.split(":").map(Number);
    const t = h * 60 + m - 30;
    return t > 0 ? `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}` : "";
  })();
  if (state.ok) return <FormMessage state={state} />;
  return (
    <form action={action} className="akte-form">
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="type" value={type} />
      {missing.length > 0 && <p className="alert alert-info" style={{ margin: 0 }}>Es fehlt noch: {missing.join(", ")}.</p>}
      <div className="row">
        <div className="field" style={{ margin: 0 }}>
          <label htmlFor={`d-${type}`}>Datum</label>
          <input id={`d-${type}`} type="date" name="date" min={today} required />
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label htmlFor={`t-${type}`}>Prüfung um</label>
          <input id={`t-${type}`} type="time" name="time" step={300} value={time} onChange={(e) => setTime(e.target.value)} required />
        </div>
        {type === "praxis" && (
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="w-praxis">Warmstunde ab</label>
            <input id="w-praxis" key={warmDefault} type="time" name="warm" step={300} defaultValue={warmDefault} />
          </div>
        )}
      </div>
      <div className="field" style={{ margin: 0 }}>
        <label htmlFor={`p-${type}`}>Ort</label>
        <input id={`p-${type}`} name="place" list={`pl-${type}`} defaultValue={places[0]} maxLength={120} />
        <datalist id={`pl-${type}`}>{places.map((p) => <option key={p} value={p} />)}</datalist>
      </div>
      <textarea name="message" rows={2} maxLength={600} placeholder="Nachricht an den Schüler (optional), z. B.: Bitte 10 Minuten früher da sein." />
      <p className="hint" style={{ margin: 0 }}>Der Schüler bestätigt verbindlich, indem er bezahlt ({priceText}). Bis dahin ist die Zeit im Kalender reserviert.</p>
      <FormMessage state={state} />
      <button className="btn btn-small" type="submit" disabled={pending || missing.length > 0}>Einladung senden</button>
    </form>
  );
}
