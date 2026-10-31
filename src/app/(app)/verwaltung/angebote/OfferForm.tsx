"use client";

import { useActionState } from "react";
import { saveOfferAction, type ActionState } from "@/app/booking-actions";
import { FormMessage } from "@/components/booking/FormMessage";

export interface OfferData {
  id?: string; kind: "slot" | "product" | "language"; title: string; description: string; durationMin: number;
  priceCents: number; needsApproval: boolean; active: boolean;
}

const euro = (c: number) => (c ? (c / 100).toFixed(2).replace(".", ",") : "");

export function OfferForm({ offer }: { offer: OfferData }) {
  const [state, action, pending] = useActionState(saveOfferAction, {} as ActionState);
  const isNew = !offer.id;
  return (
    <form action={action} className={`offer-form ${offer.active ? "" : "inactive"}`}>
      {offer.id && <input type="hidden" name="id" value={offer.id} />}
      {isNew ? (
        <div className="field">
          <label>Art</label>
          <select name="kind" defaultValue={offer.kind}>
            <option value="slot">Fahrstunde mit Termin (Kalender)</option>
            <option value="product">Produkt ohne Termin (z. B. Grundbetrag)</option>
          </select>
        </div>
      ) : <input type="hidden" name="kind" value={offer.kind} />}
      <div className="offer-grid">
        <div className="field"><label>Name</label><input type="text" name="title" defaultValue={offer.title} required maxLength={80} /></div>
        <div className="field"><label>Preis (€, inkl. MwSt.)</label><input type="text" inputMode="decimal" name="price" defaultValue={euro(offer.priceCents)} placeholder="z. B. 65,00" required /></div>
        {(offer.kind === "slot" || isNew) && (
          <div className="field"><label>Dauer (Min)</label><input type="number" name="duration" min={15} max={600} step={5} defaultValue={offer.durationMin || 45} /></div>
        )}
      </div>
      <div className="field"><label>Beschreibung für Schüler</label><input type="text" name="description" defaultValue={offer.description} maxLength={400} /></div>
      <div className="row">
        <label className="check"><input type="checkbox" name="active" defaultChecked={offer.active} /> <span>Online buchbar</span></label>
        {offer.kind !== "slot" && (
          <label className="check"><input type="checkbox" name="approval" defaultChecked={offer.needsApproval} /> <span>Ich bestätige jede Bestellung vorher</span></label>
        )}
      </div>
      <FormMessage state={state} />
      <button className="btn btn-small" type="submit" disabled={pending}>{isNew ? "Anlegen" : "Speichern"}</button>
    </form>
  );
}
