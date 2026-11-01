"use client";

import { useEffect, useRef } from "react";

export interface Milestone { title: string; sub?: string; status: "done" | "active" | "locked"; final?: boolean }

/** Der Weg zum Führerschein als Straße mit Stationen – das Auto steht dort, wo man gerade ist. */
export function Journey({ steps, percent }: { steps: Milestone[]; percent: number }) {
  const ref = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>(".jr-step.active");
    const box = ref.current;
    if (el && box) box.scrollLeft = el.offsetLeft - box.clientWidth / 2 + el.clientWidth / 2;
  }, []);
  return (
    <div className="journey">
      <div className="jr-top">
        <div className="jr-bar" aria-hidden><span style={{ width: `${Math.max(4, percent)}%` }} /></div>
        <strong>{percent}%</strong>
      </div>
      <ol className="jr-road" ref={ref}>
        {steps.map((s, i) => (
          <li key={i} className={`jr-step ${s.status} ${s.final ? "final" : ""}`}>
            <span className="jr-dot" aria-hidden>
              {s.status === "done" ? "✓" : s.final ? "🏁" : s.status === "active" ? (
                <svg viewBox="0 0 24 24"><path d="M5 16h14l-1.5-5.2A2 2 0 0 0 15.6 9H8.4a2 2 0 0 0-1.9 1.8Z" /><path d="M5 16v3h2.5v-2M19 16v3h-2.5v-2" /></svg>
              ) : i + 1}
            </span>
            <span className="jr-title">{s.title}</span>
            {s.sub && <span className="jr-sub">{s.sub}</span>}
          </li>
        ))}
      </ol>
    </div>
  );
}
