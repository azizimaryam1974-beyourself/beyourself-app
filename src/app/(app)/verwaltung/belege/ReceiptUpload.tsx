"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/** Beleg erfassen: Foto direkt mit der Kamera oder Datei (PDF) wählen, ein paar Angaben, speichern. */
export function ReceiptUpload({ today, categories, payments }: { today: string; categories: Record<string, string>; payments: Record<string, string> }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const cam = useRef<HTMLInputElement>(null), pick = useRef<HTMLInputElement>(null), form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!file || !file.type.startsWith("image/")) { setPreview(null); return; }
    const u = URL.createObjectURL(file);
    setPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!file) { setMsg({ error: "Bitte zuerst ein Foto aufnehmen oder eine Datei wählen." }); return; }
    setBusy(true); setMsg({});
    const fd = new FormData(e.currentTarget);
    fd.set("file", file);
    try {
      const r = await fetch("/api/belege", { method: "POST", body: fd });
      const j = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(j.error || "Speichern hat nicht geklappt.");
      setMsg({ ok: "Beleg gespeichert ✓" });
      setFile(null); form.current?.reset();
      if (cam.current) cam.current.value = ""; if (pick.current) pick.current.value = "";
      router.refresh();
    } catch (err) {
      setMsg({ error: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form ref={form} onSubmit={save} className="receipt-form">
      <div className="receipt-pick">
        <button type="button" className="btn btn-gold" onClick={() => cam.current?.click()}>📷 Beleg fotografieren</button>
        <button type="button" className="btn btn-secondary" onClick={() => pick.current?.click()}>Datei / PDF wählen</button>
        <input ref={cam} type="file" accept="image/*" capture="environment" hidden onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <input ref={pick} type="file" accept="image/*,application/pdf" hidden onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </div>
      {file && (
        <div className="receipt-preview">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {preview ? <img src={preview} alt="Vorschau" /> : <span className="receipt-pdf">PDF</span>}
          <span>{file.name}<small>{Math.round(file.size / 1024)} KB</small></span>
        </div>
      )}
      <div className="receipt-fields">
        <div className="field"><label htmlFor="r-day">Datum</label><input id="r-day" type="date" name="day" defaultValue={today} required /></div>
        <div className="field"><label htmlFor="r-amt">Betrag (brutto, €)</label><input id="r-amt" name="amount" inputMode="decimal" placeholder="z. B. 45,90" /></div>
        <div className="field"><label htmlFor="r-sup">Firma / Geschäft</label><input id="r-sup" name="supplier" maxLength={120} placeholder="z. B. Shell, ATU, Telekom" /></div>
        <div className="field"><label htmlFor="r-cat">Kategorie</label>
          <select id="r-cat" name="category" defaultValue="kraftstoff">{Object.entries(categories).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        <div className="field"><label htmlFor="r-pay">Bezahlt mit</label>
          <select id="r-pay" name="payment" defaultValue="karte"><option value="">–</option>{Object.entries(payments).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        <div className="field"><label htmlFor="r-vat">MwSt.</label>
          <select id="r-vat" name="vat" defaultValue=""><option value="">weiß nicht</option><option value="19">19 %</option><option value="7">7 %</option><option value="0">0 %</option></select></div>
      </div>
      <input name="note" maxLength={500} placeholder="Notiz (optional), z. B. Ölwechsel Golf" aria-label="Notiz" />
      {msg.error && <div className="alert alert-error">{msg.error}</div>}
      {msg.ok && <div className="alert alert-ok">{msg.ok}</div>}
      <button className="btn" type="submit" disabled={busy || !file}>{busy ? "Wird gespeichert …" : "Beleg speichern"}</button>
    </form>
  );
}
