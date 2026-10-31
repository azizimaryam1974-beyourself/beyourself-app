"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { TurnDirection } from "@/lib/classes";

export interface SignItem { slug: string; sign: string; turn: TurnDirection }

interface Props {
  signs: SignItem[];
  heroLoop: string;
  heroPoster: string;
  turnVideo: Record<string, string>;
}

async function exists(url: string): Promise<boolean> {
  try {
    const r = await fetch(url, { method: "HEAD", cache: "force-cache" });
    return r.ok && (r.headers.get("content-type") ?? "").startsWith("video");
  } catch {
    return false;
  }
}

/**
 * Hintergrund-Szene der Startseite + Straßenschilder als Navigation.
 * Mit Videos: Loop läuft, Klick spielt den passenden Abbiege-Clip und wechselt
 * dann zur Klassen-Seite. Ohne Videos: Ersatz-Animation (Lichter, Weg-Linie).
 */
export function CityHero({ signs, heroLoop, heroPoster, turnVideo }: Props) {
  const router = useRouter();
  const [hasLoop, setHasLoop] = useState(false);
  const [turning, setTurning] = useState<SignItem | null>(null);
  const turnRef = useRef<HTMLVideoElement>(null);
  const reduced = useRef(false);

  useEffect(() => {
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    exists(heroLoop).then(setHasLoop);
    for (const s of signs) router.prefetch(`/klasse/${s.slug}`);
  }, [heroLoop, router, signs]);

  async function choose(s: SignItem) {
    if (turning) return;
    setTurning(s);
    const go = () => router.push(`/klasse/${s.slug}`);
    if (reduced.current) return go();
    const v = turnRef.current;
    if (v && (await exists(turnVideo[s.slug]))) {
      v.src = turnVideo[s.slug];
      v.onended = go;
      v.onerror = () => setTimeout(go, 400);
      try { await v.play(); } catch { setTimeout(go, 400); }
      setTimeout(go, 6000); // Sicherheitsnetz
    } else {
      setTimeout(go, 1500); // Ersatz-Animation
    }
  }

  return (
    <>
      <div className={`city ${turning ? `turning turn-${turning.turn}` : ""} ${hasLoop ? "with-video" : ""}`} aria-hidden>
        {hasLoop && (
          <video className="city-video" src={heroLoop} poster={heroPoster} autoPlay muted loop playsInline preload="auto" />
        )}
        <video ref={turnRef} className="city-turn" muted playsInline preload="none" />
        {!hasLoop && (
          <div className="city-fallback">
            <span className="glow g1" /><span className="glow g2" /><span className="glow g3" />
            <span className="wet" />
          </div>
        )}
        <div className="city-veil" />
      </div>

      <nav className="signpost" aria-label="Führerscheinklasse wählen">
        <span className="pole" aria-hidden />
        {signs.map((s) => (
          <button
            key={s.slug}
            type="button"
            className={`street-sign dir-${s.turn} ${turning?.slug === s.slug ? "picked" : ""}`}
            onClick={() => choose(s)}
            disabled={!!turning}
          >
            <span className="sign-text">{s.sign}</span>
            <span className="sign-arrow" aria-hidden>{s.turn === "left" ? "←" : s.turn === "right" ? "→" : "↑"}</span>
          </button>
        ))}
        <span className="sign-hint">Wähle deine Straße</span>
      </nav>
    </>
  );
}
