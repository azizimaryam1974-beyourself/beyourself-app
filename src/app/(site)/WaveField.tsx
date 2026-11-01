"use client";

import { useEffect, useRef } from "react";

/**
 * Wasser-Effekt unter der Maus: Fährt die Maus über eine FREIE Fläche, breiten sich unter ihr
 * weiche Wellenringe aus – wie auf einer Wasseroberfläche. Sonst passiert nichts.
 *
 * Bewusst sparsam:
 * - nur mit Maus (Laptop/PC), nicht auf dem Handy
 * - nicht beim Scrollen, nicht über Kacheln, Texten oder Knöpfen
 * - gezeichnet wird nur, solange eine Welle sichtbar ist; danach kostet es nichts
 */
export function WaveField() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const host = canvas?.closest<HTMLElement>(".flow");
    if (!canvas || !host) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    type Ring = { x: number; y: number; born: number; power: number };
    let rings: Ring[] = [];
    let raf = 0, running = false, lastSpawn = 0, lastScroll = 0;
    let lx = -1, ly = -1;
    let W = 0, H = 0;

    const fit = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      W = canvas.clientWidth; H = canvas.clientHeight;
      const w = Math.round(W * dpr), h = Math.round(H * dpr);
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const LIFE = 1500;
    const draw = (now: number) => {
      ctx.clearRect(0, 0, W, H);
      rings = rings.filter((r) => now - r.born < LIFE);
      for (const r of rings) {
        const age = (now - r.born) / LIFE;            // 0 … 1
        const fade = (1 - age) * (1 - age);
        const base = 8 + age * 150 * r.power;
        // drei Ringe hintereinander = Wasserwelle
        for (let k = 0; k < 3; k++) {
          const rad = base - k * 16;
          if (rad <= 2) continue;
          ctx.beginPath();
          ctx.arc(r.x, r.y, rad, 0, Math.PI * 2);
          ctx.strokeStyle = k === 1 ? `rgba(168, 200, 219, ${0.22 * fade})` : `rgba(233, 215, 180, ${(0.42 - k * 0.12) * fade})`;
          ctx.lineWidth = 1.6 - k * 0.4;
          ctx.stroke();
        }
      }
      if (rings.length) raf = requestAnimationFrame(draw);
      else { running = false; ctx.clearRect(0, 0, W, H); }
    };

    const start = () => { if (!running) { running = true; fit(); raf = requestAnimationFrame(draw); } };

    // Nur freie Fläche: nicht über Inhalten
    const CONTENT = ".tile, .class-card, .steps li, .contact-card, .about-photo, .section-title, .lead, p, a, button, h1, h2, h3, .lang-ribbon, .split-head, dl";
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const now = performance.now();
      if (now - lastScroll < 250) return;                       // beim Scrollen nichts
      if ((e.target as Element | null)?.closest(CONTENT)) { lx = -1; return; }
      const r = canvas.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      const dist = lx < 0 ? 0 : Math.hypot(x - lx, y - ly);
      if (lx >= 0 && dist < 3) return;                          // nur echte Mausbewegung
      if (now - lastSpawn < 70) return;
      lastSpawn = now; lx = x; ly = y;
      rings.push({ x, y, born: now, power: 0.6 + Math.min(1, dist / 40) * 0.6 });
      if (rings.length > 16) rings.shift();
      start();
    };
    const onScroll = () => {
      lastScroll = performance.now();
      if (rings.length) { rings = []; }                          // Wellen sofort weg
    };
    const onLeave = () => { lx = -1; };

    host.addEventListener("pointermove", onMove, { passive: true });
    host.addEventListener("pointerleave", onLeave);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <div className="wave-stick" aria-hidden>
      <canvas ref={ref} className="wave-canvas" />
    </div>
  );
}
