"use client";

import { PasswordInput } from "@/components/PasswordInput";
import { DocFileInput } from "@/components/docs/DocUpload";

import Link from "next/link";
import { useActionState, useState } from "react";
import { signupAction, type FormState } from "@/app/actions";
import { LanguagePicker, type LanguageOption } from "@/components/LanguagePicker";
import { CLASS_LABEL, TRAINING_CLASSES } from "@/lib/training";

const CLASS_HINT: Record<string, string> = {
  b: "Schaltwagen",
  b197: "Prüfung auf Automatik, darfst aber auch Schaltwagen fahren",
  b78: "nur Automatik",
  umschreibung: "ausländischen Führerschein umschreiben",
};

export function SignupForm({ languages, price, grundPrice, preset }: { languages: LanguageOption[]; price: string; grundPrice: string; preset?: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(signupAction, {});
  const v = state.values ?? {};
  const fe = state.fieldErrors ?? {};
  const [wants, setWants] = useState(v.wantsPackage ?? "no");

  return (
    <form action={action} noValidate>
      {state.error && <div className="alert alert-error">{state.error}</div>}

      <div className="card">
        <h2>Deine Daten</h2>
        <div className="field">
          <label htmlFor="name">Vor- und Nachname</label>
          <input id="name" name="name" type="text" autoComplete="name" required defaultValue={v.name} />
          {fe.name && <div className="error">{fe.name}</div>}
        </div>
        <div className="field">
          <label htmlFor="email">E-Mail</label>
          <input id="email" name="email" type="email" autoComplete="email" required defaultValue={v.email} />
          {fe.email && <div className="error">{fe.email}</div>}
        </div>
        <div className="field">
          <label htmlFor="phone">Telefon / Handy</label>
          <input id="phone" name="phone" type="tel" autoComplete="tel" required defaultValue={v.phone} />
          {fe.phone && <div className="error">{fe.phone}</div>}
        </div>
        <div className="field">
          <label htmlFor="birthday">Geburtsdatum</label>
          <input id="birthday" name="birthday" type="date" autoComplete="bday" required defaultValue={v.birthday} />
          {fe.birthday && <div className="error">{fe.birthday}</div>}
        </div>
        <div className="field">
          <label htmlFor="street">Straße und Hausnummer</label>
          <input id="street" name="street" type="text" autoComplete="street-address" required defaultValue={v.street} />
          {fe.street && <div className="error">{fe.street}</div>}
        </div>
        <div className="field-row">
          <div className="field" style={{ flex: "0 0 7.5em" }}>
            <label htmlFor="zip">PLZ</label>
            <input id="zip" name="zip" type="text" inputMode="numeric" autoComplete="postal-code" maxLength={5} required defaultValue={v.zip} />
            {fe.zip && <div className="error">{fe.zip}</div>}
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="city">Ort</label>
            <input id="city" name="city" type="text" autoComplete="address-level2" required defaultValue={v.city} />
            {fe.city && <div className="error">{fe.city}</div>}
          </div>
        </div>
        <div className="field">
          <label htmlFor="password">Passwort <span className="hint">(mind. 10 Zeichen)</span></label>
          <PasswordInput id="password" name="password" autoComplete="new-password" required minLength={10} />
          {fe.password && <div className="error">{fe.password}</div>}
        </div>
      </div>

      <div className="card">
        <h2>Ausweis <span className="hint" style={{ fontWeight: 400 }}>(kannst du auch später hochladen)</span></h2>
        <p className="hint" style={{ marginTop: 0 }}>Ein Foto oder Scan, Vorder- und Rückseite, gut lesbar. <strong>Ohne Ausweis kannst du keine Fahrstunden buchen</strong> –
          wenn du ihn gerade nicht da hast, lädst du ihn später in deinem Konto hoch.</p>
        <div className="field">
          <label htmlFor="ausweis">Personalausweis oder Reisepass</label>
          <DocFileInput id="ausweis" name="ausweis" />
        </div>
        <div className="field">
          <label htmlFor="aufenthaltstitel">Aufenthaltstitel <span className="hint">(nur wenn du keinen deutschen oder EU-Pass hast)</span></label>
          <DocFileInput id="aufenthaltstitel" name="aufenthaltstitel" />
        </div>
        <p className="hint" style={{ marginBottom: 0 }}>Nur die Fahrschule sieht diese Dateien. Nummern, die wir nicht brauchen (z. B. die Zugangsnummer/CAN auf dem Ausweis), darfst du abdecken.</p>
      </div>

      <div className="card">
        <h2>Führerscheinklasse</h2>
        <div className="choice-group">
          {TRAINING_CLASSES.map((c) => (
            <label key={c} className="choice">
              <input type="radio" name="licenseClass" value={c} defaultChecked={(v.licenseClass ?? preset) === c} required />
              <span><strong>{CLASS_LABEL[c]}</strong><span className="hint" style={{ display: "block" }}>{CLASS_HINT[c]}</span></span>
            </label>
          ))}
        </div>
        {fe.licenseClass && <div className="error">{fe.licenseClass}</div>}
      </div>

      <div className="card">
        <h2>Sprachpaket <span className="hint" style={{ fontWeight: 400 }}>(freiwillig)</span></h2>
        <p className="hint">
          Live-Übersetzung im Theorieunterricht in deiner Sprache – einmalig <strong>{price}</strong> inkl. MwSt.
          für die gesamte Ausbildung.
        </p>
        <div className="choice-group" style={{ marginBottom: 16 }}>
          <label className="choice">
            <input type="radio" name="wantsPackage" value="yes" checked={wants === "yes"} onChange={() => setWants("yes")} />
            <span><strong>Ja, mit Sprachpaket ({price})</strong><span className="hint">Ich möchte den Unterricht übersetzt mitlesen.</span></span>
          </label>
          <label className="choice">
            <input type="radio" name="wantsPackage" value="no" checked={wants === "no"} onChange={() => setWants("no")} />
            <span><strong>Nein, ohne Sprachpaket</strong><span className="hint">Kann später im Konto gebucht werden.</span></span>
          </label>
        </div>

        {wants === "yes" && (
          <>
            <div className="field">
              <label>In welche Sprache soll übersetzt werden?</label>
              <LanguagePicker languages={languages} defaultValue={v.language} />
              {fe.language && <div className="error">{fe.language}</div>}
            </div>
            <div className="field">
              <label className="check">
                <input type="checkbox" name="acceptPackageTerms" />
                <span>
                  Ich habe die <Link href="/sprachpaket" target="_blank">Bedingungen für das Sprachpaket</Link> gelesen.
                  Ich verlange ausdrücklich, dass die Leistung vor Ablauf der Widerrufsfrist beginnt, und weiß,
                  dass mein Widerrufsrecht mit vollständiger Erbringung erlischt.
                </span>
              </label>
              {fe.acceptPackageTerms && <div className="error">{fe.acceptPackageTerms}</div>}
            </div>
          </>
        )}
      </div>

      <div className="card">
        <div className="field">
          <label className="check">
            <input type="checkbox" name="acceptPrivacy" defaultChecked={v.acceptPrivacy === "on"} />
            <span>Ich habe die <Link href="/datenschutz" target="_blank">Datenschutzhinweise</Link> gelesen.</span>
          </label>
          {fe.acceptPrivacy && <div className="error">{fe.acceptPrivacy}</div>}
        </div>
        <p className="hint">Mit der Anmeldung wird der <strong>Grundbetrag von {grundPrice}</strong> fällig (einmalig, inklusive Theorie-App,
          Theorieunterricht und Lernmaterial). Bezahlen kannst du danach online in deinem Konto oder bar/EC in der Fahrschule.
          Prüfungsgebühren und TÜV-Gebühren kommen erst zur Prüfung dazu.</p>
        <button className="btn btn-block" type="submit" disabled={pending}>
          {pending ? "Wird gesendet …" : wants === "yes" ? `Zahlungspflichtig anmelden (${grundPrice} + Sprachpaket ${price})` : `Zahlungspflichtig anmelden (${grundPrice})`}
        </button>
      </div>
    </form>
  );
}
