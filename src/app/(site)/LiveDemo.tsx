"use client";

import { useEffect, useRef, useState } from "react";

export interface DemoLine { code: string; label: string; native: string; rtl: boolean; text: string }

const SOURCE = "An Kreuzungen ohne Schilder gilt rechts vor links.";

/** Glaskarte: ein echter Satz aus dem Unterricht, übersetzt – zum Antippen. */
export function LiveDemo({ lines }: { lines: DemoLine[] }) {
  const [i, setI] = useState(0);
  const touched = useRef(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => { if (!touched.current) setI((n) => (n + 1) % lines.length); }, 3600);
    return () => clearInterval(t);
  }, [lines.length]);

  const cur = lines[i];
  return (
    <div className="demo glass-dark">
      <div className="demo-top">
        <span className="demo-live"><span className="dot dot-live" /> Theoriestunde läuft</span>
        <span className="demo-de">Deutsch</span>
      </div>
      <p className="demo-source">{SOURCE}</p>
      <div className="demo-out" aria-live="polite">
        <p key={cur.code} className="demo-text" lang={cur.code} dir={cur.rtl ? "rtl" : "ltr"}>{cur.text}</p>
      </div>
      <div className="demo-langs" role="tablist" aria-label="Sprache der Übersetzung">
        {lines.map((l, n) => (
          <button
            key={l.code}
            role="tab"
            aria-selected={n === i}
            className={n === i ? "on" : ""}
            onClick={() => { touched.current = true; setI(n); }}
            lang={l.code}
            title={l.label}
          >
            {l.native}
          </button>
        ))}
      </div>
    </div>
  );
}
