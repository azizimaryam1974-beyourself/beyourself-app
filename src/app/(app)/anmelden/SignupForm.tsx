"use client";

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

export function SignupForm({ languages, price, grundPrice }: { languages: LanguageOption[]; price: string; grundPrice: string }) {
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
          <label htmlFor="phone">Telefon <span className="hint">(optional)</span></label>
          <input id="phone" name="phone" type="tel" autoComplete="tel" defaultValue={v.phone} />
        </div>
        <div className="field">
          <label htmlFor="password">Passwort <span className="hint">(mind. 10 Zeichen)</span></label>
          <input id="password" name="password" type="password" autoComplete="new-password" required minLength={10} />
          {fe.password && <div className="error">{fe.password}</div>}
        </div>
      </div>

      <div className="card">
        <h2>Führerscheinklasse</h2>
        <div className="choice-group">
          {TRAINING_CLASSES.map((c) => (
            <label key={c} className="choice">
              <input type="radio" name="licenseClass" value={c} defaultChecked={v.licenseClass === c} required />
              <span><strong>{CLASS_LABEL[c]}</strong><span className="hint" style={{ display: "block" }}>{CLASS_HINT[c]}</span></span>
            </label>
          ))}
        </div>
        {fe.licenseClass && <div className="error">{fe.licenseClass}</div>}
      </div>

      <div className="card">
        <h2>Sprachpaket</h2>
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
            <input type="checkbox" name="acceptPrivacy" />
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
