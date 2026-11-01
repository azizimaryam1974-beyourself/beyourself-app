"use client";

import { useRef } from "react";

/** Kleines „?“ oben rechts in einer Kachel – öffnet ein Fenster mit der ausführlichen Erklärung. */
export function Help({ title, children }: { title: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button type="button" className="help-btn" aria-label={`Hilfe: ${title}`} onClick={() => ref.current?.showModal()}>?</button>
      <dialog ref={ref} className="help-dialog" onClick={(e) => { if (e.target === ref.current) ref.current?.close(); }}>
        <div className="help-inner">
          <div className="help-head">
            <strong>{title}</strong>
            <button type="button" aria-label="Schließen" onClick={() => ref.current?.close()}>✕</button>
          </div>
          <div className="help-body">{children}</div>
          <button type="button" className="btn btn-gold btn-block" onClick={() => ref.current?.close()}>Verstanden</button>
        </div>
      </dialog>
    </>
  );
}
