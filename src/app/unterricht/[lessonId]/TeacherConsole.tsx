"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { setLessonLiveAction } from "../../actions";
import { getSpeechToken, loadSpeechSdk } from "@/components/speech-client";

type SDK = typeof import("microsoft-cognitiveservices-speech-sdk");
type Recognizer = InstanceType<SDK["SpeechRecognizer"]>;

interface Props {
  lesson: { id: string; title: string; status: "planned" | "live" | "ended" };
  initialSent: { seq: number; text: string }[];
  phrases: string[];
  speechLocale: string;
  speechReady: boolean;
  provider: string;
  languageLabels: Record<string, string>;
}

export function TeacherConsole({ lesson, initialSent, phrases, speechLocale, speechReady, provider, languageLabels }: Props) {
  const [status, setStatus] = useState(lesson.status);
  const [pending, startTransition] = useTransition();
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [sent, setSent] = useState(initialSent.map((s) => ({ key: `db-${s.seq}`, text: s.text, failed: false })));
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<{ listeners: number; languages: string[] }>({ listeners: 0, languages: [] });
  const [manual, setManual] = useState("");
  const [joinUrl, setJoinUrl] = useState("");
  const recRef = useRef<Recognizer | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const isLive = status === "live";

  useEffect(() => setJoinUrl(`${window.location.origin}/live/${lesson.id}`), [lesson.id]);

  // Zuhörer-Statistik
  useEffect(() => {
    let stop = false;
    const tick = async () => {
      try {
        const r = await fetch(`/api/live/${lesson.id}/stats`, { cache: "no-store" });
        if (r.ok && !stop) setStats(await r.json());
      } catch {}
    };
    tick();
    const t = setInterval(tick, 5000);
    return () => { stop = true; clearInterval(t); };
  }, [lesson.id]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [sent, interim]);

  // Beim Verlassen Mikrofon freigeben
  useEffect(() => () => { void stopMic(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function publish(text: string) {
    const key = `${Date.now()}-${Math.random()}`;
    setSent((s) => [...s, { key, text, failed: false }].slice(-200));
    try {
      const r = await fetch(`/api/live/${lesson.id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `Fehler ${r.status}`);
    } catch (e) {
      setSent((s) => s.map((x) => (x.key === key ? { ...x, failed: true } : x)));
      setError(e instanceof Error ? e.message : "Senden fehlgeschlagen");
    }
  }

  async function startMic() {
    setError(null);
    try {
      const sdk = await loadSpeechSdk();
      const { token, region } = await getSpeechToken(true);
      const cfg = sdk.SpeechConfig.fromAuthorizationToken(token, region);
      cfg.speechRecognitionLanguage = speechLocale;
      // Nach kurzer Sprechpause gilt ein Satz als fertig → schneller bei den Schülern.
      cfg.setProperty(sdk.PropertyId.Speech_SegmentationSilenceTimeoutMs, "700");
      const audio = sdk.AudioConfig.fromDefaultMicrophoneInput();
      const rec = new sdk.SpeechRecognizer(cfg, audio);
      const list = sdk.PhraseListGrammar.fromRecognizer(rec);
      list.addPhrases(phrases);

      rec.recognizing = (_s, e) => setInterim(e.result.text);
      rec.recognized = (_s, e) => {
        if (e.result.reason === sdk.ResultReason.RecognizedSpeech && e.result.text.trim()) {
          setInterim("");
          void publish(e.result.text.trim());
        }
      };
      rec.canceled = (_s, e) => {
        if (e.reason === sdk.CancellationReason.Error) setError(`Spracherkennung: ${e.errorDetails}`);
        void stopMic();
      };

      await new Promise<void>((res, rej) => rec.startContinuousRecognitionAsync(res, (err) => rej(new Error(err))));
      recRef.current = rec;
      setListening(true);
      // Token läuft nach 10 Min ab → alle 8 Min erneuern.
      refreshTimer.current = setInterval(async () => {
        try {
          const t = await getSpeechToken(true);
          if (recRef.current) recRef.current.authorizationToken = t.token;
        } catch (e) {
          setError("Token-Erneuerung fehlgeschlagen – Mikrofon bitte neu starten.");
        }
      }, 8 * 60 * 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Mikrofon konnte nicht gestartet werden");
      setListening(false);
    }
  }

  async function stopMic() {
    if (refreshTimer.current) clearInterval(refreshTimer.current);
    refreshTimer.current = null;
    const rec = recRef.current;
    recRef.current = null;
    setListening(false);
    setInterim("");
    if (rec) {
      await new Promise<void>((res) => rec.stopContinuousRecognitionAsync(() => res(), () => res()));
      rec.close();
    }
  }

  function setLive(live: boolean) {
    startTransition(async () => {
      if (!live) await stopMic();
      await setLessonLiveAction(lesson.id, live);
      setStatus(live ? "live" : "ended");
    });
  }

  return (
    <div className="live-shell">
      <div className="live-head">
        <div>
          <Link href="/unterricht" className="hint">← Alle Stunden</Link>
          <h1 style={{ margin: "4px 0" }}>{lesson.title}</h1>
          <div className="row hint">
            {isLive ? (<><span className="dot dot-live" /> Live</>) : <span className="badge badge-muted">{status === "ended" ? "Beendet" : "Noch nicht gestartet"}</span>}
            <span>·</span>
            <span>{stats.listeners} verbunden</span>
            {stats.languages.length > 0 && <span>· übersetzt nach {stats.languages.map((c) => languageLabels[c] ?? c).join(", ")}</span>}
          </div>
        </div>
        <div className="row">
          {!isLive ? (
            <button className="btn" onClick={() => setLive(true)} disabled={pending}>{status === "ended" ? "Wieder live schalten" : "Stunde starten"}</button>
          ) : (
            <button className="btn btn-danger" onClick={() => setLive(false)} disabled={pending}>Stunde beenden</button>
          )}
        </div>
      </div>

      {error && <div className="alert alert-error" role="alert">{error}</div>}
      {provider === "mock" && <div className="alert alert-info">Testmodus: Übersetzungen sind nur markiert (z. B. „[TR] …“).</div>}

      <div className="grid grid-2">
        <div className="card" style={{ marginBottom: 0 }}>
          <h2>Mikrofon</h2>
          {!speechReady ? (
            <p className="hint">Azure Speech ist noch nicht eingerichtet. Bis dahin Sätze unten eintippen.</p>
          ) : listening ? (
            <button className="btn btn-danger btn-block" onClick={() => void stopMic()}>⏹ Mikrofon aus</button>
          ) : (
            <button className="btn btn-block" onClick={() => void startMic()} disabled={!isLive}>🎙 Mikrofon an</button>
          )}
          {!isLive && speechReady && <p className="hint" style={{ marginTop: 8 }}>Erst die Stunde starten.</p>}
          <form
            style={{ marginTop: 16 }}
            onSubmit={(e) => {
              e.preventDefault();
              if (manual.trim()) { void publish(manual.trim()); setManual(""); }
            }}
          >
            <label htmlFor="manual">Satz eintippen <span className="hint">(z. B. Fachbegriff korrigieren)</span></label>
            <div className="row">
              <input id="manual" type="text" value={manual} onChange={(e) => setManual(e.target.value)} disabled={!isLive} style={{ flex: "1 1 200px" }} />
              <button className="btn btn-secondary" type="submit" disabled={!isLive || !manual.trim()}>Senden</button>
            </div>
          </form>
        </div>
        <div className="card" style={{ marginBottom: 0 }}>
          <h2>Schüler einladen</h2>
          <p className="hint">Schüler sehen die Stunde unter „Mein Konto“, sobald sie live ist. Direktlink:</p>
          <p className="mono">{joinUrl}</p>
          <button className="btn btn-secondary btn-small" onClick={() => navigator.clipboard?.writeText(joinUrl)}>Link kopieren</button>
        </div>
      </div>

      <div className="captions" ref={listRef} style={{ height: "40vh" }}>
        {sent.length === 0 && !interim && <div className="empty">Erkannte Sätze erscheinen hier.</div>}
        {sent.map((s) => (
          <div key={s.key} className="caption">
            <div className="caption-text" style={{ fontSize: "1.1rem" }}>{s.text}</div>
            {s.failed && <div className="caption-err">Nicht gesendet</div>}
          </div>
        ))}
        {interim && <div className="caption interim">{interim} …</div>}
      </div>
    </div>
  );
}
