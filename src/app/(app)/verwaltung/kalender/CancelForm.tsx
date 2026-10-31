"use client";

import { useActionState } from "react";
import { adminCancelAction, type ActionState } from "@/app/booking-actions";
import { MessagePicker, type TemplateOption } from "@/components/booking/MessagePicker";
import { FormMessage } from "@/components/booking/FormMessage";

/** Bestätigten/bezahlten Termin durch die Fahrschule absagen. */
export function CancelForm({ bookingId, templates, paid }: { bookingId: string; templates: TemplateOption[]; paid: boolean }) {
  const [state, action, pending] = useActionState(adminCancelAction, {} as ActionState);
  if (state.ok) return <FormMessage state={state} />;
  return (
    <details className="cancel-box">
      <summary>Absagen …</summary>
      <form action={action}>
        <input type="hidden" name="bookingId" value={bookingId} />
        <MessagePicker templates={templates} initial={templates[0]?.body ?? ""} required placeholder="Grund der Absage" />
        {paid && <p className="hint" style={{ margin: 0 }}>Der Schüler bekommt den vollen Betrag als Guthaben.</p>}
        {paid && <label className="check"><input type="checkbox" name="money" /> <span>Stattdessen Geld zurück auf Karte/PayPal</span></label>}
        <label className="check"><input type="checkbox" name="reopen" /> <span>Termin danach wieder für andere freigeben</span></label>
        <FormMessage state={state} />
        <button className="btn btn-danger btn-small" type="submit" disabled={pending}>Absage senden</button>
      </form>
    </details>
  );
}
