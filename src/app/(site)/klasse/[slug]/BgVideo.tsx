"use client";

import { useEffect, useState } from "react";

/** Matter Video-Hintergrund der Klassen-Seite (Ersatz: Lichtstimmung). */
export function BgVideo({ src, tone }: { src: string; tone: "left" | "right" | "straight" }) {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    fetch(src, { method: "HEAD" })
      .then((r) => setOk(r.ok && (r.headers.get("content-type") ?? "").startsWith("video")))
      .catch(() => setOk(false));
  }, [src]);
  return (
    <div className={`class-bg tone-${tone}`} aria-hidden>
      {ok ? <video src={src} autoPlay muted loop playsInline preload="auto" /> : <div className="class-bg-fallback" />}
      <div className="class-bg-veil" />
    </div>
  );
}
