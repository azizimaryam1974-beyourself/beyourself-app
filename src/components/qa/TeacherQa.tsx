"use client";

import { useEffect, useState } from "react";
import { EMPTY_QA, qaPost, type QaState } from "./types";

/** Fragen-Steuerung der Fahrschule: auf den Beamer, beantwortet, ausblenden, stummschalten, Hände. */
export function TeacherQa({ lessonId }: { lessonId: string }) {
  const [qa, setQa] = useState<QaState>(EMPTY_QA);
  const [showBlocked, setShowBlocked] = useState(false);
  useEffect(() => {
    const es = new EventSource(`/api/live/${lessonId}/stream?original=1`);
    es.addEventListener("qa", (e) => setQa(JSON.parse((e as MessageEvent).data)));
    return () => es.close();
  }, [lessonId]);
  const act = (body: Record<string, unknown>) => void qaPost(lessonId, body);
  const open = qa.questions.filter((q) => q.status === "visible").reverse();
  const done = qa.questions.filter((q) => q.status === "answered" || q.status === "hidden").reverse().slice(0, 15);
  const blocked = qa.questions.filter((q) => q.status === "blocked").reverse();
  const onBeamer = qa.questions.find((q) => q.onBeamer);
  const muted = new Set(qa.muted_ids ?? []);

  return (
    <section className="card qa-teacher">
      <div className="qa-head">
        <h2>Fragen {open.length > 0 && <span className="tab-count">{open.length}</span>}</h2>
        <a className="btn btn-secondary btn-small" href={`/unterricht/${lessonId}/beamer`} target="_blank" rel="noreferrer">Beamer-Ansicht öffnen ↗</a>
      </div>
      {onBeamer && (
        <div className="qa-beamer-now">
          <span>Auf dem Beamer: <strong>{onBeamer.name}</strong> – {onBeamer.german}</span>
          <button className="btn btn-small" onClick={() => { act({ action: "status", id: onBeamer.id, status: "answered" }); act({ action: "beamer", id: null }); }}>Beantwortet ✓</button>
        </div>
      )}
      {qa.hands.length > 0 && (
        <div className="qa-hands-t">
          {qa.hands.map((h) => (
            <span key={h.userId} className="chip">✋ {h.name}
              <button className="link-btn" onClick={() => act({ action: "lower", userId: h.userId })} aria-label={`Hand von ${h.name} senken`}>senken</button></span>
          ))}
        </div>
      )}
      {open.length === 0 && !onBeamer && <p className="hint">Noch keine offenen Fragen.</p>}
      <ul className="qa-list">
        {open.filter((q) => !q.onBeamer).map((q) => (
          <li key={q.id} className="qa-item">
            <div className="qa-who">{q.name}{q.lang !== "de" && q.lang !== "?" ? ` · aus dem ${q.lang.toUpperCase()} übersetzt` : ""}</div>
            <div className="qa-text">{q.german}</div>
            {q.lang !== "de" && q.lang !== "?" && <div className="qa-orig">{q.original}</div>}
            <div className="row">
              <button className="btn btn-gold btn-small" onClick={() => act({ action: "beamer", id: q.id })}>Auf den Beamer</button>
              <button className="btn btn-secondary btn-small" onClick={() => act({ action: "status", id: q.id, status: "answered" })}>Beantwortet</button>
              <button className="link-btn" onClick={() => act({ action: "status", id: q.id, status: "hidden" })}>ausblenden</button>
              {q.userId && <button className="link-btn" onClick={() => act({ action: "mute", userId: q.userId, muted: !muted.has(q.userId!) })}>{muted.has(q.userId) ? "Fragen wieder erlauben" : "für diese Stunde stumm"}</button>}
            </div>
          </li>
        ))}
      </ul>
      {blocked.length > 0 && (
        <div className="qa-blocked">
          <button className="link-btn" onClick={() => setShowBlocked((v) => !v)}>{blocked.length} automatisch zurückgehalten {showBlocked ? "▲" : "▼"}</button>
          {showBlocked && (
            <ul className="qa-list">
              {blocked.map((q) => (
                <li key={q.id} className="qa-item blocked">
                  <div className="qa-who">{q.name} · <span className="hint">{q.reason}</span></div>
                  <div className="qa-text">{q.german}</div>
                  <div className="row">
                    <button className="btn btn-secondary btn-small" onClick={() => act({ action: "status", id: q.id, status: "visible" })}>Doch zeigen</button>
                    {q.userId && <button className="link-btn" onClick={() => act({ action: "mute", userId: q.userId, muted: !muted.has(q.userId!) })}>{muted.has(q.userId) ? "Fragen wieder erlauben" : "für diese Stunde stumm"}</button>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {done.length > 0 && (
        <details className="qa-done-list"><summary className="hint">Erledigt ({done.length})</summary>
          <ul className="qa-list">{done.map((q) => <li key={q.id} className="qa-item answered"><div className="qa-who">{q.name}</div><div className="qa-text">{q.german}</div></li>)}</ul>
        </details>
      )}
    </section>
  );
}
