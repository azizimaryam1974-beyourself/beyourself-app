"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { shrinkImage } from "@/lib/client/shrink";

/** Knopf „Hochladen“ für eine Unterlage: Foto (Kamera) oder PDF, mehrere Seiten möglich. */
export function DocUpload({ type, userId, label = "Hochladen", primary }: { type: string; userId?: string; label?: string; primary?: boolean }) {
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function upload(list: FileList | null) {
    if (!list?.length) return;
    setBusy(true); setErr("");
    try {
      const fd = new FormData();
      fd.set("type", type);
      if (userId) fd.set("userId", userId);
      for (const f of Array.from(list).slice(0, 4)) fd.append("files", await shrinkImage(f));
      const r = await fetch("/api/unterlagen", { method: "POST", body: fd });
      if (!r.ok) throw new Error(((await r.json().catch(() => ({}))) as { error?: string }).error || "Hochladen hat nicht geklappt.");
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  }

  return (
    <span className="doc-up">
      <button type="button" className={`btn btn-small ${primary ? "" : "btn-secondary"}`} disabled={busy} onClick={() => ref.current?.click()}>
        {busy ? "Lädt hoch …" : label}
      </button>
      <input ref={ref} type="file" accept="image/*,application/pdf" multiple hidden onChange={(e) => upload(e.target.files)} />
      {err && <span className="error">{err}</span>}
    </span>
  );
}

/** Dateiauswahl im Anmeldeformular: verkleinert Fotos sofort, damit das Absenden schnell geht. */
export function DocFileInput({ name, id }: { name: string; id: string }) {
  const [info, setInfo] = useState("");
  return (
    <>
      <input id={id} name={name} type="file" accept="image/*,application/pdf" multiple className="doc-file"
        onChange={async (e) => {
          const input = e.currentTarget;
          const files = Array.from(input.files ?? []).slice(0, 4);
          if (!files.length) { setInfo(""); return; }
          setInfo("Wird vorbereitet …");
          try {
            const small = await Promise.all(files.map((f) => shrinkImage(f)));
            const dt = new DataTransfer();
            small.forEach((f) => dt.items.add(f));
            input.files = dt.files;
          } catch { /* Original bleibt */ }
          setInfo(`${files.length} ${files.length === 1 ? "Datei" : "Dateien"} ausgewählt ✓`);
        }} />
      {info && <span className="hint">{info}</span>}
    </>
  );
}
