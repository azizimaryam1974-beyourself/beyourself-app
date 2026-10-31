"use client";

import { useState } from "react";

export interface TemplateOption { id: string; label: string; body: string }

/** Vorlage auswählen → Text erscheint im Feld und kann frei geändert werden. */
export function MessagePicker({ templates, name = "message", initial = "", placeholder, required }: {
  templates: TemplateOption[]; name?: string; initial?: string; placeholder?: string; required?: boolean;
}) {
  const [text, setText] = useState(initial);
  return (
    <div className="msg-picker">
      {templates.length > 0 && (
        <div className="chips" role="group" aria-label="Vorlage wählen">
          {templates.map((t) => (
            <button key={t.id} type="button" className={`chip ${text === t.body ? "on" : ""}`} onClick={() => setText(t.body)}>{t.label}</button>
          ))}
          <button type="button" className={`chip ${text === "" ? "on" : ""}`} onClick={() => setText("")}>Eigener Text</button>
        </div>
      )}
      <textarea name={name} value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={1000}
        placeholder={placeholder ?? "Nachricht an den Schüler (optional)"} required={required} />
    </div>
  );
}
