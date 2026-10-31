"use client";

import { useActionState, useState } from "react";
import { createResetLinkAction, deleteStudentAction } from "@/app/actions";

/** Passwort-Link, Datenauskunft und Löschen für einen Schüler. */
export function StudentTools({ userId, name }: { userId: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(createResetLinkAction, {} as { link?: string; error?: string });
  const [copied, setCopied] = useState(false);

  return (
    <details open={open} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
      <summary className="hint" style={{ cursor: "pointer" }}>Mehr …</summary>
      <div style={{ display: "grid", gap: 10, marginTop: 8, minWidth: 240 }}>
        <form action={action}>
          <input type="hidden" name="userId" value={userId} />
          <button className="btn btn-secondary btn-small" type="submit" disabled={pending}>Passwort-Link erstellen</button>
        </form>
        {state.link && (
          <div className="alert alert-info" style={{ margin: 0 }}>
            <div className="hint">Gültig 24 Stunden, nur einmal nutzbar. An {name} weitergeben:</div>
            <div className="mono">{state.link}</div>
            <button
              className="btn btn-secondary btn-small"
              type="button"
              onClick={() => navigator.clipboard?.writeText(state.link!).then(() => setCopied(true))}
            >
              {copied ? "Kopiert" : "Link kopieren"}
            </button>
          </div>
        )}
        {state.error && <div className="error">{state.error}</div>}

        <a className="btn btn-secondary btn-small" href={`/api/admin/students/${userId}/export`}>Datenauskunft (JSON)</a>

        <form action={deleteStudentAction} style={{ borderTop: "1px solid var(--line)", paddingTop: 10 }}>
          <input type="hidden" name="userId" value={userId} />
          <label className="check" style={{ fontSize: "0.9rem" }}>
            <input type="checkbox" name="confirm" required />
            <span>Konto von {name} endgültig löschen. Die Paketbuchung bleibt anonym für die Buchhaltung.</span>
          </label>
          <button className="btn btn-danger btn-small" type="submit">Konto löschen</button>
        </form>
      </div>
    </details>
  );
}
