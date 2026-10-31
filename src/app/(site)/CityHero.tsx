"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { TurnDirection } from "@/lib/classes";

export interface SignItem { slug: string; sign: string; turn: TurnDirection }

interface Props {
  signs: SignItem[];
  heroLoop: string;
  heroPoster: string;
  turnVideo: Record<string, string>;
}

async function exists(url: string, kind = "video"): Promise<boolean> {
  try {
    const r = await fetch(url, { method: "HEAD", cache: "force-cache" });
    return r.ok && (r.headers.get("content-type") ?? "").startsWith(kind);
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
  const [hasPoster, setHasPoster] = useState(false);
  const [turning, setTurning] = useState<SignItem | null>(null);
  const [viaVideo, setViaVideo] = useState(false);
  const [playing, setPlaying] = useState(false);
  const turnRef = useRef<HTMLVideoElement>(null);
  const cityRef = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState<React.CSSProperties>({});
  const reduced = useRef(false);

  // Bühne exakt wie "object-fit: cover" berechnen, damit Blinker/Scheinwerfer
  // genau auf dem Auto im Standbild sitzen (Bild 2000 × 1125).
  const layout = useCallback(() => {
    const el = cityRef.current;
    if (!el) return;
    const W = el.clientWidth, H = el.clientHeight;
    const s = Math.max(W / 2000, H / 1125);
    const w = 2000 * s, h = 1125 * s;
    const fx = W < 920 ? 0.58 : 0.5;
    setStage({ width: w, height: h, left: (W - w) * fx, top: (H - h) * 0.6 });
  }, []);
  useEffect(() => {
    layout();
    window.addEventListener("resize", layout);
    return () => window.removeEventListener("resize", layout);
  }, [layout, hasPoster, hasLoop]);

  useEffect(() => {
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    exists(heroLoop).then(setHasLoop);
    exists(heroPoster, "image").then(setHasPoster);
    for (const s of signs) router.prefetch(`/klasse/${s.slug}`);
  }, [heroLoop, router, signs]);

  async function choose(s: SignItem) {
    if (turning) return;
    setTurning(s);
    const go = () => router.push(`/klasse/${s.slug}`);
    if (reduced.current) return go();
    const v = turnRef.current;
    if (v && (await exists(turnVideo[s.slug]))) {
      // Echter Abbiege-Clip: erst blinkt das Auto im Standbild (auf der richtigen
      // Seite – das kann der KI-Generator nicht zuverlässig), dann läuft das Video.
      setViaVideo(true);
      v.src = turnVideo[s.slug];
      v.load();
      v.onended = go;
      v.onerror = () => setTimeout(go, 400);
      // Links/rechts: erst blinken. B78 (geradeaus): Lichthupe ist im Video selbst.
      if (s.turn !== "straight") await new Promise((r) => setTimeout(r, 950));
      setPlaying(true);
      try { await v.play(); } catch { setTimeout(go, 400); }
      setTimeout(go, 7000); // Sicherheitsnetz
    } else {
      setTimeout(go, 2600); // Ersatz-Animation: blinken (0,9 s) + Kameraschwenk
    }
  }

  return (
    <>
      <div ref={cityRef} className={`city ${turning ? `turning turn-${turning.turn}` : ""} ${hasLoop || hasPoster ? "with-video" : ""} ${hasLoop ? "has-loop" : ""} ${viaVideo ? "via-video" : ""} ${playing ? "playing" : ""}`} aria-hidden>
        {hasLoop && (
          <video className="city-video" src={heroLoop} poster={heroPoster} autoPlay muted loop playsInline preload="auto" />
        )}
        <video ref={turnRef} className="city-turn" muted playsInline preload="none" />
        {(hasLoop || hasPoster) && (
          <div className={`city-stage ${hasLoop ? "overlay-only" : ""}`} style={stage}>
            <div className="city-kb">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {!hasLoop && <img className="city-still" src={heroPoster} alt="" />}
              <span className="blinker bl-left" />
              <span className="blinker bl-right" />
              <span className="headlights" />
            </div>
          </div>
        )}
        {!hasLoop && !hasPoster && (
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
