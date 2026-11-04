"use client";

import { useEffect, useRef } from "react";

/** Aufklapp-Fenster (z. B. Glocke): schließt bei Klick daneben, bei Esc und beim Antippen eines Links darin. */
export function Popover({ className, summary, label, children }: { className?: string; summary: React.ReactNode; label: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = (e: Event) => {
      const el = ref.current;
      if (!el?.open) return;
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !el.contains(e.target as Node)) el.open = false;
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", close); };
  }, []);
  return (
    <details ref={ref} className={className} onClick={(e) => { if ((e.target as HTMLElement).closest("a")) ref.current!.open = false; }}>
      <summary className="dash-bell" aria-label={label}>{summary}</summary>
      {children}
    </details>
  );
}

/** Aufklappbares Menü (z. B. „Tag anpassen“): schließt bei Tipp daneben, Esc oder ✕. */
export function DetailsMenu({ className, summary, summaryClass, children }: { className?: string; summary: React.ReactNode; summaryClass?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = (e: Event) => {
      const el = ref.current;
      if (!el?.open) return;
      const pop = el.querySelector("[data-pop]");
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !(pop?.contains(e.target as Node) || el.querySelector("summary")?.contains(e.target as Node))) el.open = false;
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", close); };
  }, []);
  return (
    <details ref={ref} className={className}>
      <summary className={summaryClass}>{summary}</summary>
      <div data-pop className="menu-pop-wrap">
        <button type="button" className="menu-close" aria-label="Schließen" onClick={() => { if (ref.current) ref.current.open = false; }}>✕</button>
        {children}
      </div>
    </details>
  );
}
