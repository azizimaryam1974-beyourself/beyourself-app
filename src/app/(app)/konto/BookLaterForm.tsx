"use client";

import Link from "next/link";
import { useActionState } from "react";
import { bookLaterAction, type FormState } from "@/app/actions";
import { LanguagePicker, type LanguageOption } from "@/components/LanguagePicker";

export function BookLaterForm({ languages, price }: { languages: LanguageOption[]; price: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(bookLaterAction, {});
  return (
    <form action={action}>
      {state.error && <div className="alert alert-error">{state.error}</div>}
      <div className="field">
        <label>Sprache</label>
        <LanguagePicker languages={languages} />
      </div>
      <div className="field">
        <label className="check">
          <input type="checkbox" name="acceptPackageTerms" />
          <span>
            Ich habe die <Link href="/sprachpaket" target="_blank">Bedingungen</Link> gelesen und verlange ausdrücklich,
            dass die Leistung vor Ablauf der Widerrufsfrist beginnt.
          </span>
        </label>
      </div>
      <button className="btn" type="submit" disabled={pending}>Sprachpaket zahlungspflichtig buchen ({price})</button>
    </form>
  );
}
