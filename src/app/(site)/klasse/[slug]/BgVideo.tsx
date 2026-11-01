"use client";

import { useEffect, useRef, useState } from "react";

/** Video-Hintergrund der Klassen-Seite (Ersatz: Lichtstimmung). */
export function BgVideo({ src, tone }: { src: string; tone: "left" | "right" | "straight" }) {
  const [ok, setOk] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    fetch(src, { method: "HEAD" })
      .then((r) => setOk(r.ok && (r.headers.get("content-type") ?? "").startsWith("video")))
      .catch(() => setOk(false));
  }, [src]);
  // Video anhalten, wenn es aus dem Bild gescrollt ist (flüssigeres Scrollen).
  useEffect(() => {
    const el = box.current;
    const v = el?.querySelector("video");
    if (!el || !v || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) v.play().catch(() => {}); else v.pause(); }, { threshold: 0.02 });
    io.observe(el);
    return () => io.disconnect();
  }, [ok]);
  return (
    <div ref={box} className={`class-bg tone-${tone}`} aria-hidden>
      {ok ? <video src={src} autoPlay muted loop playsInline preload="auto" /> : <div className="class-bg-fallback" />}
      <div className="class-bg-veil" />
    </div>
  );
}
