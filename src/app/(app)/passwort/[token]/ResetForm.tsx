"use client";

import { useActionState } from "react";
import { PasswordInput } from "@/components/PasswordInput";
import { resetPasswordAction, type FormState } from "@/app/actions";

export function ResetForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(resetPasswordAction, {});
  return (
    <form action={action} className="card">
      {state.error && <div className="alert alert-error">{state.error}</div>}
      <input type="hidden" name="token" value={token} />
      <div className="field">
        <label htmlFor="password">Neues Passwort <span className="hint">(mind. 10 Zeichen)</span></label>
        <PasswordInput id="password" name="password" autoComplete="new-password" required minLength={10} />
        {state.fieldErrors?.password && <div className="error">{state.fieldErrors.password}</div>}
      </div>
      <div className="field">
        <label htmlFor="password2">Passwort wiederholen</label>
        <PasswordInput id="password2" name="password2" autoComplete="new-password" required />
      </div>
      <button className="btn btn-block" type="submit" disabled={pending}>Passwort speichern</button>
    </form>
  );
}
