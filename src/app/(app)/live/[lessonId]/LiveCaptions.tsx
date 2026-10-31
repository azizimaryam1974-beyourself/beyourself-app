"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSpeechToken } from "@/components/speech-client";
import { Speaker } from "@/components/tts";
import { StudentQa } from "@/components/qa/StudentQa";
import { EMPTY_QA, type QaState } from "@/components/qa/types";

export interface Caption {
  seq: number;
  original: string;
  text: string | null;
  error?: string;
}

interface Props {
  lessonId: string;
  title: string;
  initialLive: boolean;
  initial: Caption[];
  language: { code: string; labelDe: string; nativeLabel: string; rtl: boolean; ttsVoice: string } | null;
  canSpeak: boolean;
  /** Darf Fragen stellen (angemeldet bzw. spontane Stunde) */
  canAsk: boolean;
  notAllowedText: string;
  startsAt: string | null;
}

const SIZES = ["1.1rem", "1.35rem", "1.7rem", "2.1rem"];

export function LiveCaptions({ lessonId, title, initialLive, initial, language, canSpeak, canAsk, notAllowedText, startsAt }: Props) {
  const [qa, setQa] = useState<QaState>(EMPTY_QA);
  const [captions, setCaptions] = useState<Caption[]>(initial);
  const [live, setLive] = useState(initialLive);
  const [connected, setConnected] = useState(false);
  const [showOriginal, setShowOriginal] = useState(true);
  const [size, setSize] = useState(1);
  const [speak, setSpeak] = useState(false);
  const [ttsError, setTtsError] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const speakerRef = useRef<Speaker | null>(null);

  // ---------- Vorlesen (Azure Neural Voice) ----------
  const say = useCallback((text: string) => {
    speakerRef.current?.say(text);
  }, []);

  useEffect(() => () => speakerRef.current?.stop(), []);

  // ---------- Live-Verbindung ----------
  useEffect(() => {
    const es = new EventSource(`/api/live/${lessonId}/stream`);
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.addEventListener("status", (e) => setLive(JSON.parse((e as MessageEvent).data).status === "live"));
    es.addEventListener("qa", (e) => setQa(JSON.parse((e as MessageEvent).data)));
    es.addEventListener("caption", (e) => {
      const c = JSON.parse((e as MessageEvent).data) as Caption;
      setCaptions((prev) => (prev.some((p) => p.seq === c.seq) ? prev : [...prev, c].slice(-400)));
      if (c.text && language) say(c.text);
    });
    return () => es.close();
  }, [lessonId, language, say]);

  // Automatisch mitscrollen, außer man hat selbst hochgescrollt.
  useEffect(() => {
    const el = boxRef.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [captions]);

  const onScroll = () => {
    const el = boxRef.current;
    if (el) stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  const toggleSpeak = async () => {
    setTtsError(null);
    if (speak) {
      speakerRef.current?.stop();
      speakerRef.current = null;
      setSpeak(false);
      return;
    }
    if (!language) return;
    const sp = new Speaker(language.ttsVoice);
    sp.onError = setTtsError;
    try {
      // Zuerst entsperren – noch im Fingertipp, vor jedem "await" auf das Netz.
      await sp.unlock();
      await getSpeechToken();
    } catch (e) {
      setTtsError(e instanceof Error && /NotAllowed/i.test(e.name + e.message)
        ? "Das Handy hat den Ton blockiert. Bitte Lautstärke prüfen und noch einmal antippen."
        : e instanceof Error ? e.message : "Vorlesen nicht verfügbar");
      return;
    }
    speakerRef.current = sp;
    setSpeak(true);
    sp.say(language.nativeLabel); // kurzer Hörtest
  };

  const dir = language?.rtl ? "rtl" : "ltr";

  return (
    <div className="live-shell" style={{ ["--caption-size" as string]: SIZES[size] }}>
      <div className="live-head">
        <div>
          <h1 style={{ marginBottom: 4 }}>{title}</h1>
          <div className="row hint">
            {live ? (<><span className="dot dot-live" /> <span>Live</span></>) : <span className="badge badge-muted">Nicht live</span>}
            <span>·</span>
            <span lang={language?.code} dir={dir}>{language ? language.nativeLabel : "Deutsch (Original)"}</span>
            {!connected && <span className="badge badge-warn">Verbinde …</span>}
          </div>
        </div>
        <div className="row">
          <button className="btn btn-secondary btn-small" onClick={() => setSize((s) => Math.max(0, s - 1))} aria-label="Schrift kleiner">A−</button>
          <button className="btn btn-secondary btn-small" onClick={() => setSize((s) => Math.min(SIZES.length - 1, s + 1))} aria-label="Schrift größer">A+</button>
          {language && (
            <button className="btn btn-secondary btn-small" onClick={() => setShowOriginal((v) => !v)} aria-pressed={showOriginal}>
              {showOriginal ? "Deutsch ausblenden" : "Deutsch zeigen"}
            </button>
          )}
          {language && canSpeak && (
            <button className={`btn btn-small ${speak ? "" : "btn-secondary"}`} onClick={toggleSpeak} aria-pressed={speak}>
              {speak ? "🔊 Vorlesen an" : "🔈 Vorlesen"}
            </button>
          )}
        </div>
      </div>
      {ttsError && <div className="alert alert-error">{ttsError}</div>}
      {speak && !ttsError && (
        <p className="hint" style={{ margin: 0 }}>Kopfhörer benutzen. Auf dem iPhone die Lautstärke-Tasten seitlich nach oben drücken.</p>
      )}

      <div className="captions" ref={boxRef} onScroll={onScroll} aria-live="polite" aria-relevant="additions">
        {captions.length === 0 ? (
          <div className="empty">{live ? "Warte auf den ersten Satz …" : startsAt ? `Die Stunde beginnt ${startsAt}. Diese Seite startet dann von selbst.` : "Die Stunde hat noch nicht begonnen."}</div>
        ) : (
          captions.map((c, i) => (
            <div key={c.seq} className={`caption ${i === captions.length - 1 ? "latest" : ""}`}>
              {language ? (
                <>
                  <div className="caption-text" lang={language.code} dir={dir}>{c.text ?? c.original}</div>
                  {c.text === null && <div className="caption-err">{c.error ?? "Keine Übersetzung"} – Original:</div>}
                  {showOriginal && c.text !== null && <div className="caption-orig" lang="de">{c.original}</div>}
                </>
              ) : (
                <div className="caption-text" lang="de">{c.original}</div>
              )}
            </div>
          ))
        )}
      </div>
      {!language && (
        <p className="hint">Du siehst das deutsche Original. Mit dem Sprachpaket siehst du jeden Satz in deiner Sprache.</p>
      )}
      <StudentQa lessonId={lessonId} qa={qa} live={live} canAsk={canAsk} notAllowedText={notAllowedText} />
    </div>
  );
}
