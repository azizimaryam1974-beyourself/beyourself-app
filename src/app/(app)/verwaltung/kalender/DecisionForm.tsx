"use client";

import { useActionState, useState } from "react";
import { decideAction, type ActionState } from "@/app/booking-actions";
import { MessagePicker, type TemplateOption } from "@/components/booking/MessagePicker";
import { FormMessage } from "@/components/booking/FormMessage";

/** Anfrage bestätigen oder ablehnen – mit Vorlage oder eigenem Text. */
export function DecisionForm({ bookingId, confirmTemplates, declineTemplates, payWindowMin }: {
  bookingId: string; confirmTemplates: TemplateOption[]; declineTemplates: TemplateOption[]; payWindowMin: number;
}) {
  const [state, action, pending] = useActionState(decideAction, {} as ActionState);
  const [mode, setMode] = useState<"confirm" | "decline" | null>(null);
  if (state.ok) return <FormMessage state={state} />;
  return (
    <div className="decision">
      {!mode && (
        <div className="row">
          <button type="button" className="btn btn-small" onClick={() => setMode("confirm")}>Bestätigen</button>
          <button type="button" className="btn btn-secondary btn-small" onClick={() => setMode("decline")}>Ablehnen</button>
        </div>
      )}
      {mode && (
        <form action={action}>
          <input type="hidden" name="bookingId" value={bookingId} />
          <input type="hidden" name="decision" value={mode} />
          <MessagePicker
            key={mode}
            templates={mode === "confirm" ? confirmTemplates : declineTemplates}
            initial={(mode === "confirm" ? confirmTemplates : declineTemplates)[0]?.body ?? ""}
            required={mode === "decline"}
            placeholder={mode === "confirm" ? "Nachricht zur Bestätigung (optional)" : "Grund für die Absage"}
          />
          {mode === "confirm" && <p className="hint">Danach hat der Schüler {payWindowMin} Minuten zum Bezahlen. Andere Anfragen für diesen Termin werden automatisch abgelehnt.</p>}
          <FormMessage state={state} />
          <div className="row">
            <button className={`btn btn-small ${mode === "decline" ? "btn-danger" : ""}`} type="submit" disabled={pending}>
              {mode === "confirm" ? "Bestätigung senden" : "Absage senden"}
            </button>
            <button type="button" className="btn btn-secondary btn-small" onClick={() => setMode(null)}>Zurück</button>
          </div>
        </form>
      )}
    </div>
  );
}
