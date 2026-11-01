"use client";

import { useRef, useState, useTransition } from "react";
import { setClassAction } from "@/app/training-actions";
import { CLASS_LABEL, TRAINING_CLASSES } from "@/lib/training";

/** Klasse wählen = sofort gespeichert (kein extra Knopf nötig). */
export function ClassSelect({ userId, current }: { userId: string; current: string | null }) {
  const form = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  return (
    <form ref={form} className="class-select" action={(fd) => start(async () => { await setClassAction(fd); setSaved(true); setTimeout(() => setSaved(false), 2500); })}>
      <input type="hidden" name="userId" value={userId} />
      <label className="class-select-label" htmlFor="cls-sel">Führerscheinklasse</label>
      <select id="cls-sel" name="licenseClass" defaultValue={current ?? ""} disabled={pending}
        onChange={() => form.current?.requestSubmit()}>
        {!current && <option value="" disabled>Klasse wählen …</option>}
        {TRAINING_CLASSES.map((c) => <option key={c} value={c}>{CLASS_LABEL[c]}</option>)}
      </select>
      <span className="class-select-state" aria-live="polite">{pending ? "speichert …" : saved ? "gespeichert ✓" : ""}</span>
    </form>
  );
}
