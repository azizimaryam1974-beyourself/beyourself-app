"use client";

import { useActionState } from "react";
import { createSlotsAction, type ActionState } from "@/app/booking-actions";
import { FormMessage } from "@/components/booking/FormMessage";

const DAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

export function SlotCreator({ offers, defaultDate }: { offers: Array<{ id: string; title: string; durationMin: number; bookable: boolean }>; defaultDate: string }) {
  const [state, action, pending] = useActionState(createSlotsAction, {} as ActionState);
  return (
    <form action={action} className="slot-creator">
      <div className="sc-grid">
        <div className="field">
          <label htmlFor="sc-offer">Art</label>
          <select id="sc-offer" name="offerId" required>
            {offers.map((o) => <option key={o.id} value={o.id}>{o.title} ({o.durationMin} Min){o.bookable ? "" : " – noch ohne Preis"}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="sc-date">Ab Datum</label>
          <input id="sc-date" type="date" name="date" defaultValue={defaultDate} required />
        </div>
        <div className="field">
          <label htmlFor="sc-time">Erste Stunde um</label>
          <input id="sc-time" type="time" name="time" defaultValue="08:00" step={300} required />
        </div>
        <div className="field">
          <label htmlFor="sc-count">Stunden hintereinander</label>
          <input id="sc-count" type="number" name="count" min={1} max={12} defaultValue={1} />
        </div>
        <div className="field">
          <label htmlFor="sc-gap">Pause dazwischen (Min)</label>
          <input id="sc-gap" type="number" name="gap" min={0} max={240} step={5} defaultValue={15} />
        </div>
        <div className="field">
          <label htmlFor="sc-weeks">Für wie viele Wochen</label>
          <input id="sc-weeks" type="number" name="weeks" min={1} max={26} defaultValue={1} />
        </div>
      </div>
      <fieldset className="field">
        <legend>An diesen Tagen <span className="hint">(nichts gewählt = nur am Datum oben)</span></legend>
        <div className="chips">
          {DAYS.map((d, i) => (
            <label key={d} className="chip-check"><input type="checkbox" name="weekday" value={i} /> {d}</label>
          ))}
        </div>
      </fieldset>
      <FormMessage state={state} />
      <button className="btn btn-gold" type="submit" disabled={pending}>{pending ? "Wird freigegeben …" : "Termine freigeben"}</button>
    </form>
  );
}
