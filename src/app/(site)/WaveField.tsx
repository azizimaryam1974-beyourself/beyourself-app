"use client";

import { useEffect, useRef } from "react";

/**
 * Interaktiver Wellen-Hintergrund: feine goldene/türkise Linien, die ruhig atmen und
 * wie Wasser mitschwingen, wenn Maus oder Finger darüberfahren.
 *
 * Technik (leicht für Handy und Laptop):
 * - eine einzige Zeichenfläche in Bildschirmgröße (klebt beim Scrollen, wird nicht mitgescrollt)
 * - jede Linie besteht aus Punkten mit Feder + Nachbar-Kopplung → Wellen laufen weiter und federn nach
 * - zeichnet nur, solange der Bereich sichtbar ist; bei „weniger Bewegung“ (Systemeinstellung) nur ein Standbild
 */
export function WaveField() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const host = canvas?.parentElement?.parentElement; // .flow
    if (!canvas || !host) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const small = window.matchMedia("(max-width: 720px)").matches;

    const LINES = small ? 14 : 22;
    const PTS = small ? 40 : 72;
    let W = 0, H = 0, dpr = 1;
    let off = new Float32Array(LINES * PTS); // Auslenkung
    let vel = new Float32Array(LINES * PTS); // Geschwindigkeit

    const size = () => {
      dpr = Math.min(window.devicePixelRatio || 1, small ? 1.5 : 2);
      W = canvas.clientWidth; H = canvas.clientHeight;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    size();

    // Maus/Finger (Koordinaten relativ zur Zeichenfläche)
    let mx = -9999, my = -9999, pmx = -9999, pmy = -9999, lastMove = 0;
    const onMove = (x: number, y: number) => {
      const r = canvas.getBoundingClientRect();
      mx = x - r.left; my = y - r.top; lastMove = performance.now();
    };
    const pm = (e: PointerEvent) => onMove(e.clientX, e.clientY);
    const tm = (e: TouchEvent) => { const t = e.touches[0]; if (t) onMove(t.clientX, t.clientY); };
    // Beim Scrollen auf dem Handy: sanfter Schwung über die ganze Breite
    let lastScroll = window.scrollY, scrollKick = 0;
    const onScroll = () => { const y = window.scrollY; scrollKick += Math.max(-40, Math.min(40, y - lastScroll)); lastScroll = y; };
    window.addEventListener("pointermove", pm, { passive: true });
    window.addEventListener("touchmove", tm, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", size);

    const gap = () => H / (LINES + 1);
    const baseY = (l: number, i: number, t: number) => {
      const x = (i / (PTS - 1)) * W;
      // ruhiges Atmen: zwei langsame, gegeneinander laufende Wellen
      return gap() * (l + 1) + Math.sin(x * 0.004 + t * 0.00035 + l * 0.45) * 10 + Math.sin(x * 0.0021 - t * 0.0002 + l) * 7;
    };

    let raf = 0, visible = false, t0 = performance.now();
    const step = (now: number) => {
      const t = now - t0;
      // Kraft durch die Bewegung der Maus: drückt Punkte in Bewegungsrichtung, weich auslaufend
      const R = small ? 130 : 200;
      const moving = now - lastMove < 120 && pmx > -9000;
      const dvx = moving ? mx - pmx : 0, dvy = moving ? my - pmy : 0;
      const speed = Math.min(60, Math.hypot(dvx, dvy));
      const kick = scrollKick * 0.06; scrollKick *= 0.6;
      for (let l = 0; l < LINES; l++) {
        const row = l * PTS;
        for (let i = 0; i < PTS; i++) {
          const k = row + i;
          if (speed > 0.5) {
            const x = (i / (PTS - 1)) * W, y = baseY(l, i, t) + off[k];
            const d2 = (x - mx) ** 2 + (y - my) ** 2;
            if (d2 < R * R * 4) {
              const f = Math.exp(-d2 / (R * R));
              vel[k] += (dvy * 0.32 + Math.sign(y - my || 1) * speed * 0.2) * f;
            }
          }
          if (kick) vel[k] += kick * Math.sin(i * 0.25 + l * 0.6);
          // Kopplung an die Nachbarn → die Welle läuft weiter (das „Saftige“)
          const left = i > 0 ? off[k - 1] : 0, right = i < PTS - 1 ? off[k + 1] : 0;
          vel[k] += (left + right - 2 * off[k]) * 0.22 - off[k] * 0.01;
          vel[k] *= 0.962;
        }
        for (let i = 0; i < PTS; i++) { const k = row + i; off[k] = Math.max(-90, Math.min(90, off[k] + vel[k])); }
      }
      pmx = mx; pmy = my;

      ctx.clearRect(0, 0, W, H);
      ctx.lineWidth = small ? 1 : 1.25;
      for (let l = 0; l < LINES; l++) {
        const row = l * PTS;
        const mix = l / (LINES - 1);
        // oben gold, unten türkis – passend zur Seite
        const r = Math.round(214 - 119 * mix), g = Math.round(184 - 26 * mix), b = Math.round(120 + 40 * mix);
        ctx.strokeStyle = `rgba(${r},${g},${b},${0.2 + 0.14 * Math.sin(mix * Math.PI)})`;
        ctx.beginPath();
        let px = 0, py = baseY(l, 0, t) + off[row];
        ctx.moveTo(px, py);
        for (let i = 1; i < PTS; i++) {
          const x = (i / (PTS - 1)) * W, y = baseY(l, i, t) + off[row + i];
          ctx.quadraticCurveTo(px, py, (px + x) / 2, (py + y) / 2);
          px = x; py = y;
        }
        ctx.lineTo(px, py);
        ctx.stroke();
      }
      if (visible && !reduced) raf = requestAnimationFrame(step);
    };

    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      cancelAnimationFrame(raf);
      if (visible) raf = requestAnimationFrame(step);
    });
    io.observe(host);
    if (reduced) requestAnimationFrame(step);

    return () => {
      io.disconnect(); cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", pm); window.removeEventListener("touchmove", tm);
      window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", size);
      off = new Float32Array(0); vel = new Float32Array(0);
    };
  }, []);

  return (
    <div className="wave-stick" aria-hidden>
      <canvas ref={ref} className="wave-canvas" />
    </div>
  );
}
