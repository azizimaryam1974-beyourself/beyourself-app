"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatMessage, Side } from "@/lib/server/chat";

const fmt = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" });
const fmtDay = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", weekday: "long", day: "numeric", month: "long" });
const dayOf = (t: number) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(t);

/** Chat-Fenster: Nachrichten, Antworten auf eine bestimmte Nachricht, Foto/PDF anhängen. Aktualisiert sich alle paar Sekunden. */
export function ChatView({ studentId, side, initial, otherName, canClear }: {
  studentId: string; side: Side; initial: ChatMessage[]; otherName: string; canClear?: boolean;
}) {
  const [msgs, setMsgs] = useState<ChatMessage[]>(initial);
  const [text, setText] = useState("");
  const [reply, setReply] = useState<ChatMessage | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [menu, setMenu] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const last = msgs.length ? msgs[msgs.length - 1].createdAt : 0;

  const scrollDown = () => { requestAnimationFrame(() => { const el = listRef.current; if (el) el.scrollTop = el.scrollHeight; }); };
  useEffect(() => { scrollDown(); }, []);

  const poll = useCallback(async () => {
    try {
      const r = await fetch(`/api/chat/${studentId}?after=${last}`, { cache: "no-store" });
      if (!r.ok) return;
      const j = (await r.json()) as { messages: ChatMessage[] };
      if (j.messages.length) {
        setMsgs((m) => [...m, ...j.messages.filter((n) => !m.some((x) => x.id === n.id))]);
        scrollDown();
      }
    } catch { /* offline – nächster Versuch */ }
  }, [studentId, last]);
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === "visible") poll(); }, 5000);
    const onVis = () => { if (document.visibilityState === "visible") poll(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", onVis); };
  }, [poll]);

  useEffect(() => {
    if (!file || !file.type.startsWith("image/")) { setPreview(null); return; }
    const u = URL.createObjectURL(file);
    setPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (busy || (!text.trim() && !file)) return;
    setBusy(true); setError("");
    const fd = new FormData();
    fd.set("body", text);
    if (reply) fd.set("replyTo", reply.id);
    if (file) fd.set("file", file);
    try {
      const r = await fetch(`/api/chat/${studentId}`, { method: "POST", body: fd });
      const j = (await r.json()) as { message?: ChatMessage; error?: string };
      if (!r.ok || !j.message) throw new Error(j.error || "Senden hat nicht geklappt.");
      setMsgs((m) => [...m, j.message!]);
      setText(""); setReply(null); setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      scrollDown();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function clearChat() {
    if (!confirm("Chat für dich leeren? Die Fahrschule behält die Nachrichten.")) return;
    const r = await fetch(`/api/chat/${studentId}/leeren`, { method: "POST" });
    if (r.ok) setMsgs([]);
  }

  const jump = (id: string) => {
    const el = document.getElementById(`m-${id}`);
    if (el) { el.scrollIntoView({ behavior: "smooth", block: "center" }); el.classList.add("flash"); setTimeout(() => el.classList.remove("flash"), 1200); }
  };

  return (
    <div className="chat">
      <div className="chat-list" ref={listRef} onClick={() => setMenu(null)}>
        {msgs.length === 0 && <p className="chat-empty">Noch keine Nachrichten. Schreib {otherName} einfach hier.</p>}
        {msgs.map((m, i) => {
          const mine = m.sender === side;
          const newDay = i === 0 || dayOf(msgs[i - 1].createdAt) !== dayOf(m.createdAt);
          return (
            <div key={m.id}>
              {newDay && <div className="chat-day">{fmtDay.format(m.createdAt)}</div>}
              <div id={`m-${m.id}`} className={`chat-msg ${mine ? "mine" : "theirs"}`}>
                <div className="chat-bubble" onClick={(e) => { e.stopPropagation(); setMenu(menu === m.id ? null : m.id); }}>
                  {m.quote && (
                    <button type="button" className="chat-quote" onClick={(e) => { e.stopPropagation(); jump(m.quote!.id); }}>
                      <strong>{m.quote.sender === side ? "Du" : otherName}</strong>
                      <span>{m.quote.text}</span>
                    </button>
                  )}
                  {m.file && (m.file.type.startsWith("image/") && !/heic|heif/.test(m.file.type)
                    ? <a href={`/api/chat/datei/${m.id}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img className="chat-img" src={`/api/chat/datei/${m.id}`} alt={m.file.name} loading="lazy" />
                      </a>
                    : <a className="chat-file" href={`/api/chat/datei/${m.id}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                        📎 {m.file.name} <small>{Math.max(1, Math.round(m.file.size / 1024))} KB</small>
                      </a>)}
                  {m.body && <p>{m.body}</p>}
                  <span className="chat-time">{fmt.format(m.createdAt)}{mine && side === "school" && (m.readAt ? " · gelesen" : " · zugestellt")}</span>
                </div>
                {menu === m.id && (
                  <button type="button" className="chat-reply-btn" onClick={(e) => { e.stopPropagation(); setReply(m); setMenu(null); }}>↩︎ Antworten</button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <form className="chat-compose" onSubmit={send}>
        {reply && (
          <div className="chat-replying">
            <div><strong>Antwort an {reply.sender === side ? "dich" : otherName}</strong><span>{reply.body || (reply.file ? `📎 ${reply.file.name}` : "")}</span></div>
            <button type="button" onClick={() => setReply(null)} aria-label="Antwort abbrechen">✕</button>
          </div>
        )}
        {file && (
          <div className="chat-replying">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {preview ? <img src={preview} alt="" className="chat-thumb" /> : <span>📎</span>}
            <div><strong>Anhang</strong><span>{file.name}</span></div>
            <button type="button" onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ""; }} aria-label="Anhang entfernen">✕</button>
          </div>
        )}
        {error && <div className="chat-error">{error}</div>}
        <div className="chat-row">
          <label className="chat-attach" aria-label="Foto oder Datei anhängen">
            <input ref={fileRef} type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            <svg viewBox="0 0 24 24" aria-hidden><path d="M21 11.5 12.5 20a5.5 5.5 0 0 1-7.8-7.8l8.5-8.5a3.7 3.7 0 0 1 5.2 5.2l-8.5 8.5a1.8 1.8 0 0 1-2.6-2.6l7.8-7.8" /></svg>
          </label>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={1} maxLength={4000} placeholder="Nachricht schreiben …"
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && window.matchMedia("(min-width: 861px)").matches) { e.preventDefault(); (e.currentTarget.form as HTMLFormElement).requestSubmit(); } }} />
          <button className="chat-send" type="submit" disabled={busy || (!text.trim() && !file)} aria-label="Senden">
            <svg viewBox="0 0 24 24" aria-hidden><path d="M4 12 20 4l-6 16-3-7Z" /></svg>
          </button>
        </div>
        {canClear && msgs.length > 0 && <button type="button" className="link-btn chat-clear" onClick={clearChat}>Chat für mich leeren</button>}
      </form>
    </div>
  );
}
