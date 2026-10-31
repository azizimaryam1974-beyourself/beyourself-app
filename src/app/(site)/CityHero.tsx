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
    // Über dem Loop-Video: genau wie das Video zentriert (sonst sitzt der Blinker
    // auf dem Handy neben dem Auto). Nur beim Standbild gilt die eigene Ausrichtung.
    const overVideo = el.classList.contains("has-loop");
    const fx = overVideo ? 0.5 : W < 920 ? 0.58 : 0.5;
    const fy = overVideo ? 0.5 : 0.6;
    setStage({ width: w, height: h, left: (W - w) * fx, top: (H - h) * fy });
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

  // Alles, was nach dem Klick noch "nachlaufen" könnte (Timer, Video-Ereignisse),
  // wird hier gesammelt und beim Verlassen der Seite sauber beendet. Sonst springt
  // die Seite nach "Zurück zur Kreuzung" wieder auf die Klassen-Seite.
  const timers = useRef<number[]>([]);
  const done = useRef(false);
  const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)); };
  const stopAll = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    const v = turnRef.current;
    if (v) { v.onended = null; v.onerror = null; v.pause(); }
  }, []);
  const reset = useCallback(() => {
    stopAll();
    done.current = false;
    setTurning(null); setViaVideo(false); setPlaying(false);
  }, [stopAll]);
  useEffect(() => {
    // Zurück-Taste des Browsers (Seite aus dem Zwischenspeicher): Kreuzung neu aufbauen
    const onShow = (e: PageTransitionEvent) => { if (e.persisted) reset(); };
    window.addEventListener("pageshow", onShow);
    return () => { window.removeEventListener("pageshow", onShow); stopAll(); done.current = true; };
  }, [reset, stopAll]);

  async function choose(s: SignItem) {
    if (turning) return;
    done.current = false;
    setTurning(s);
    const go = () => {
      if (done.current) return; // genau einmal
      done.current = true;
      stopAll();
      router.push(`/klasse/${s.slug}`);
    };
    if (reduced.current) return go();
    const v = turnRef.current;
    if (v && (await exists(turnVideo[s.slug]))) {
      if (done.current) return;
      setViaVideo(true);
      v.src = turnVideo[s.slug];
      v.load();
      v.onended = go;
      v.onerror = () => later(go, 300);
      // Links/rechts: kurz blinken (über dem stehenden Auto), dann läuft der Clip.
      if (s.turn !== "straight") await new Promise((r) => later(() => r(null), 950));
      if (done.current) return;
      setPlaying(true);
      try { await v.play(); } catch { later(go, 300); return; }
      // Sicherheitsnetz nur bis kurz nach Clip-Ende – und es wird beim Verlassen gelöscht.
      const ms = Number.isFinite(v.duration) && v.duration > 0 ? v.duration * 1000 + 800 : 6000;
      later(go, ms);
    } else {
      later(go, 2600); // Ersatz-Animation: blinken (0,9 s) + Kameraschwenk
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
