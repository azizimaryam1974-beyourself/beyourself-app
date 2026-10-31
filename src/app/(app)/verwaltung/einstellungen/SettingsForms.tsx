"use client";

import { useActionState } from "react";
import { deleteTemplateAction, saveSettingsAction, saveTemplateAction, type ActionState } from "@/app/booking-actions";
import { FormMessage } from "@/components/booking/FormMessage";

export function SettingsForm({ s, testfahrtMinutes }: { s: { payWindowMin: number; freeCancelHours: number; minLeadHours: number; maxOpenRequests: number; cancelCutoffHour: number; lateChargePct: number; noShowChargePct: number }; testfahrtMinutes: number }) {
  const [state, action, pending] = useActionState(saveSettingsAction, {} as ActionState);
  return (
    <form action={action}>
      <div className="offer-grid">
        <div className="field"><label htmlFor="pw">Zeit zum Bezahlen nach Bestätigung (Min)</label><input id="pw" type="number" name="payWindowMin" min={10} max={1440} defaultValue={s.payWindowMin} /></div>
        <div className="field"><label htmlFor="fc">Kostenlos absagen bis … Std. vorher</label><input id="fc" type="number" name="freeCancelHours" min={0} max={336} defaultValue={s.freeCancelHours} /></div>
        <div className="field"><label htmlFor="cc">… aber spätestens am Vortag um (Uhr)</label><input id="cc" type="number" name="cancelCutoffHour" min={12} max={24} defaultValue={s.cancelCutoffHour} /></div>
        <div className="field"><label htmlFor="lc">Späte Absage: berechnet (%)</label><input id="lc" type="number" name="lateChargePct" min={0} max={100} defaultValue={s.lateChargePct} /></div>
        <div className="field"><label htmlFor="ns">Nicht erschienen / zu spät: berechnet (%)</label><input id="ns" type="number" name="noShowChargePct" min={0} max={100} defaultValue={s.noShowChargePct} /></div>
        <div className="field"><label htmlFor="ml">Anfragen frühestens … Std. vorher</label><input id="ml" type="number" name="minLeadHours" min={0} max={336} defaultValue={s.minLeadHours} /></div>
        <div className="field"><label htmlFor="mo">Max. offene Anfragen je Schüler</label><input id="mo" type="number" name="maxOpenRequests" min={1} max={50} defaultValue={s.maxOpenRequests} /></div>
        <div className="field"><label htmlFor="tf">Testfahrt (B197)</label>
          <select id="tf" name="testfahrtMinutes" defaultValue={String(testfahrtMinutes)}>
            <option value="30">30 Min · 45,00 €</option>
            <option value="45">45 Min · 68,00 €</option>
          </select>
        </div>
      </div>
      <FormMessage state={state} />
      <button className="btn btn-small" type="submit" disabled={pending}>Speichern</button>
    </form>
  );
}

export function TemplateForm({ t }: { t: { id?: string; kind: string; label: string; body: string } }) {
  const [state, action, pending] = useActionState(saveTemplateAction, {} as ActionState);
  return (
    <div className="tpl">
      <form action={action}>
        {t.id && <input type="hidden" name="id" value={t.id} />}
        <input type="hidden" name="kind" value={t.kind} />
        <input type="text" name="label" defaultValue={t.label} placeholder="Kurzname, z. B. Krankheit" maxLength={40} required aria-label="Name der Vorlage" />
        <textarea name="body" defaultValue={t.body} rows={2} maxLength={1000} placeholder="Text der Nachricht" required aria-label="Text der Vorlage" />
        <FormMessage state={state} />
        <div className="row">
          <button className="btn btn-secondary btn-small" type="submit" disabled={pending}>{t.id ? "Speichern" : "Vorlage hinzufügen"}</button>
        </div>
      </form>
      {t.id && (
        <form action={deleteTemplateAction}>
          <input type="hidden" name="id" value={t.id} />
          <button className="link-btn" type="submit">Löschen</button>
        </form>
      )}
    </div>
  );
}
