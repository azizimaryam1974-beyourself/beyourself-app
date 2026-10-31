"use client";

import { useState } from "react";
import { qaPost, type QaState } from "./types";

/** Fragen-Bereich für Schüler: Hand heben, Frage schreiben (in jeder Sprache), Fragen der anderen sehen. */
export function StudentQa({ lessonId, qa, live, canAsk, notAllowedText }: { lessonId: string; qa: QaState; live: boolean; canAsk: boolean; notAllowedText: string }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const visible = qa.questions.filter((q) => q.status !== "hidden" || q.mine).slice(-30).reverse();

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true); setMsg(null);
    const r = await qaPost(lessonId, { action: "ask", text });
    setBusy(false);
    if (r.error) setMsg({ ok: false, text: r.error });
    else {
      setText("");
      setMsg(r.shown ? { ok: true, text: "Deine Frage ist angekommen." } : { ok: false, text: "Deine Frage wird nicht angezeigt – sie passt nicht in den Unterricht. Die Fahrschule kann sie trotzdem sehen." });
    }
  }

  return (
    <section className="qa-panel" aria-label="Fragen">
      <div className="qa-head">
        <h2>Fragen</h2>
        {live && canAsk && !qa.muted && (
          <button type="button" className={`btn btn-small ${qa.myHand ? "btn-gold" : "btn-secondary"}`} aria-pressed={qa.myHand}
            onClick={() => qaPost(lessonId, { action: "hand", up: !qa.myHand })}>
            ✋ {qa.myHand ? "Hand senken" : "Hand heben"}
          </button>
        )}
      </div>
      {qa.hands.length > 0 && <p className="hint qa-hands">✋ {qa.hands.map((h) => h.name).join(", ")}</p>}
      {!live ? <p className="hint">Fragen kannst du stellen, sobald die Stunde läuft.</p>
        : !canAsk ? <p className="hint">{notAllowedText}</p>
        : qa.muted ? <p className="hint">Die Fahrschule hat Fragen für dich in dieser Stunde ausgeschaltet.</p>
        : (
          <form onSubmit={ask} className="qa-form">
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} maxLength={300}
              placeholder="Deine Frage – gern in deiner Sprache. Die Fahrschule sieht sie auf Deutsch." aria-label="Deine Frage" />
            <button className="btn btn-small" type="submit" disabled={busy || text.trim().length < 3}>{busy ? "Wird geprüft …" : "Frage senden"}</button>
          </form>
        )}
      {msg && <div className={`alert ${msg.ok ? "alert-ok" : "alert-info"}`} role="status">{msg.text}</div>}
      <ul className="qa-list">
        {visible.map((q) => (
          <li key={q.id} className={`qa-item ${q.onBeamer ? "on" : ""} ${q.status}`}>
            <div className="qa-who">{q.mine ? "Du" : q.name}{q.status === "answered" && <span className="qa-done"> · beantwortet ✓</span>}{q.onBeamer && <span className="qa-done"> · auf dem Bildschirm</span>}</div>
            {q.status === "blocked" ? <div className="hint">Nicht angezeigt (passt nicht in den Unterricht).</div> : (
              <>
                <div className="qa-text" lang="de">{q.german}</div>
                {q.mine && q.lang !== "de" && q.lang !== "?" && q.original !== q.german && <div className="qa-orig">{q.original}</div>}
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
