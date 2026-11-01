"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

/** Profilfoto wählen: wird im Browser auf 512 px verkleinert (schnell, wenig Speicher) und hochgeladen. */
export function PhotoUpload({ hasPhoto, children }: { hasPhoto: boolean; children: React.ReactNode }) {
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function shrink(file: File): Promise<Blob> {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = url; });
      const s = Math.min(img.naturalWidth, img.naturalHeight);
      const c = document.createElement("canvas");
      c.width = c.height = 512;
      c.getContext("2d")!.drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, 512, 512);
      return await new Promise<Blob>((ok, bad) => c.toBlob((b) => (b ? ok(b) : bad(new Error("Bild"))), "image/jpeg", 0.86));
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function upload(file: File | null, remove = false) {
    setBusy(true); setErr("");
    try {
      const fd = new FormData();
      if (remove) fd.set("remove", "1");
      else if (file) fd.set("file", new File([await shrink(file)], "profil.jpg", { type: "image/jpeg" }));
      const r = await fetch("/api/profilbild", { method: "POST", body: fd });
      if (!r.ok) throw new Error(((await r.json().catch(() => ({}))) as { error?: string }).error || "Hat nicht geklappt.");
      router.refresh();
    } catch (e) {
      setErr((e as Error).message === "Bild" ? "Dieses Bild kann der Browser nicht lesen – bitte ein anderes wählen." : (e as Error).message);
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  }

  return (
    <div className="photo-up">
      <button type="button" className="photo-up-btn" onClick={() => ref.current?.click()} disabled={busy} aria-label="Profilfoto ändern">
        {children}
        <span className="photo-up-cam" aria-hidden>📷</span>
      </button>
      <input ref={ref} type="file" accept="image/*" hidden onChange={(e) => upload(e.target.files?.[0] ?? null)} />
      <div className="photo-up-actions">
        <button type="button" className="link-btn" onClick={() => ref.current?.click()} disabled={busy}>{busy ? "Lädt …" : hasPhoto ? "Foto ändern" : "Foto hinzufügen"}</button>
        {hasPhoto && <button type="button" className="link-btn" onClick={() => upload(null, true)} disabled={busy}>entfernen</button>}
      </div>
      {err && <div className="error">{err}</div>}
    </div>
  );
}
