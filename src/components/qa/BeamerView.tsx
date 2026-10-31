"use client";

import { useEffect, useState } from "react";
import { EMPTY_QA, type QaState } from "./types";

/** Große Ansicht für Beamer/LED: aktuelle Frage, Untertitel, QR-Code zum Mitmachen. */
export function BeamerView({ lessonId, title, qrSvg, joinUrl }: { lessonId: string; title: string; qrSvg: string; joinUrl: string }) {
  const [qa, setQa] = useState<QaState>(EMPTY_QA);
  const [lines, setLines] = useState<string[]>([]);
  const [live, setLive] = useState(false);
  useEffect(() => {
    const es = new EventSource(`/api/live/${lessonId}/stream?original=1`);
    es.addEventListener("qa", (e) => setQa(JSON.parse((e as MessageEvent).data)));
    es.addEventListener("status", (e) => setLive(JSON.parse((e as MessageEvent).data).status === "live"));
    es.addEventListener("caption", (e) => setLines((l) => [...l, JSON.parse((e as MessageEvent).data).original as string].slice(-3)));
    return () => es.close();
  }, [lessonId]);
  const q = qa.questions.find((x) => x.onBeamer);
  const waiting = qa.questions.filter((x) => x.status === "visible" && !x.onBeamer).length;

  return (
    <div className="beamer">
      <header className="beamer-top">
        <div className="beamer-title">{title}</div>
        <div className="beamer-meta">{live ? "● LIVE" : "noch nicht gestartet"}{qa.hands.length ? ` · ✋ ${qa.hands.length}` : ""}{waiting ? ` · ${waiting} Fragen warten` : ""}</div>
      </header>
      <main className="beamer-main">
        {q ? (
          <div className="beamer-q">
            <div className="beamer-q-who">Frage von {q.name}</div>
            <div className="beamer-q-text">{q.german}</div>
          </div>
        ) : (
          <div className="beamer-idle">
            <div className="beamer-qr" dangerouslySetInnerHTML={{ __html: qrSvg }} />
            <div>
              <div className="beamer-idle-h">Fragen? Einfach mit dem Handy.</div>
              <div className="beamer-idle-t">QR-Code scannen, anmelden, Frage schreiben – gern in deiner Sprache.</div>
              <div className="beamer-url">{joinUrl}</div>
            </div>
          </div>
        )}
      </main>
      <footer className="beamer-captions" aria-live="polite">
        {lines.map((l, i) => <div key={i} className={i === lines.length - 1 ? "last" : ""}>{l}</div>)}
      </footer>
    </div>
  );
}
