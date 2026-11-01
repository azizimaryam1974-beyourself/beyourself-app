"use client";

import { useActionState } from "react";
import { saveDetailsAction, type DetailsState } from "@/app/details-actions";

/** Geburtstag, Adresse, Telefon – Pflichtangaben für Schüler. */
export function DetailsForm({ userId, initial, submitLabel = "Speichern" }: {
  userId?: string; initial: { birthday: string; street: string; zip: string; city: string; phone: string }; submitLabel?: string;
}) {
  const [state, action, pending] = useActionState<DetailsState, FormData>(saveDetailsAction, {});
  const v = state.values ?? initial;
  const e = state.errors ?? {};
  return (
    <form action={action} noValidate className="details-form" key={state.ok ? JSON.stringify(state.values) : "f"}>
      {userId && <input type="hidden" name="userId" value={userId} />}
      <div className="field-row">
        <div className="field" style={{ flex: "1 1 11em" }}>
          <label htmlFor="d-birthday">Geburtsdatum</label>
          <input id="d-birthday" name="birthday" type="date" required defaultValue={v.birthday} />
          {e.birthday && <div className="error">{e.birthday}</div>}
        </div>
        <div className="field" style={{ flex: "1 1 11em" }}>
          <label htmlFor="d-phone">Telefon / Handy</label>
          <input id="d-phone" name="phone" type="tel" autoComplete="tel" required defaultValue={v.phone} />
          {e.phone && <div className="error">{e.phone}</div>}
        </div>
      </div>
      <div className="field">
        <label htmlFor="d-street">Straße und Hausnummer</label>
        <input id="d-street" name="street" type="text" autoComplete="street-address" required defaultValue={v.street} />
        {e.street && <div className="error">{e.street}</div>}
      </div>
      <div className="field-row">
        <div className="field" style={{ flex: "0 0 7.5em" }}>
          <label htmlFor="d-zip">PLZ</label>
          <input id="d-zip" name="zip" type="text" inputMode="numeric" autoComplete="postal-code" maxLength={5} required defaultValue={v.zip} />
          {e.zip && <div className="error">{e.zip}</div>}
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor="d-city">Ort</label>
          <input id="d-city" name="city" type="text" autoComplete="address-level2" required defaultValue={v.city} />
          {e.city && <div className="error">{e.city}</div>}
        </div>
      </div>
      <div className="row">
        <button className="btn btn-small" type="submit" disabled={pending}>{pending ? "Speichert …" : submitLabel}</button>
        {state.ok && <span className="badge badge-ok">Gespeichert ✓</span>}
      </div>
    </form>
  );
}
