"use client";

import { useActionState } from "react";
import { adjustCreditAction, type ActionState } from "@/app/booking-actions";
import { FormMessage } from "@/components/booking/FormMessage";

export function CreditForm({ userId }: { userId: string }) {
  const [state, action, pending] = useActionState(adjustCreditAction, {} as ActionState);
  return (
    <details className="edit-box">
      <summary className="btn btn-gold btn-small">Guthaben aufladen (Einzahlung bar/Überweisung)</summary>
      <form action={action} className="price-form">
        <input type="hidden" name="userId" value={userId} />
        <div className="row">
          <label className="check"><input type="radio" name="type" value="deposit" defaultChecked /> <span>Einzahlung erhalten (zählt als Einnahme)</span></label>
          <label className="check"><input type="radio" name="type" value="manual" /> <span>Gutschreiben (geschenkt/Korrektur)</span></label>
          <label className="check"><input type="radio" name="type" value="payout" /> <span>Ausgezahlt (z. B. per Überweisung)</span></label>
        </div>
        <div className="row">
          <select name="method" aria-label="Zahlungsweg" defaultValue="Überweisung" style={{ width: "auto" }}>
            <option>Überweisung</option><option value="bar">bar/EC</option>
          </select>
          <input type="text" inputMode="decimal" name="amount" placeholder="Betrag in €, z. B. 45,00" aria-label="Betrag" style={{ flex: "1 1 160px" }} required />
          <input type="text" name="note" placeholder="Notiz (optional)" aria-label="Notiz" style={{ flex: "2 1 220px" }} />
        </div>
        <FormMessage state={state} />
        <button className="btn btn-small" type="submit" disabled={pending}>Buchen</button>
      </form>
    </details>
  );
}
