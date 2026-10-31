"use client";

import { useActionState } from "react";
import { loginAction, type FormState } from "@/app/actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(loginAction, {});
  return (
    <form action={action} className="card">
      {state.error && <div className="alert alert-error">{state.error}</div>}
      <div className="field">
        <label htmlFor="email">E-Mail</label>
        <input id="email" name="email" type="email" autoComplete="email" required defaultValue={state.values?.email} />
      </div>
      <div className="field">
        <label htmlFor="password">Passwort</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      <button className="btn btn-block" type="submit" disabled={pending}>{pending ? "…" : "Einloggen"}</button>
    </form>
  );
}
