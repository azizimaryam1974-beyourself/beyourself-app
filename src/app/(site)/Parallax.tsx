"use client";

import { useEffect } from "react";

/** Setzt --sy (Scrollposition) für dezente Parallax-Ebenen im Kopfbereich. */
export function Parallax() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    // Nur am Kopfbereich setzen (an <html> würde jede Scroll-Bewegung die ganze Seite neu berechnen → Ruckeln),
    // und nur solange der Kopfbereich sichtbar ist.
    const hero = document.querySelector<HTMLElement>(".hero");
    let last = -1;
    const on = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const y = Math.min(window.scrollY, 900);
        if (y === last || !hero) return;
        last = y;
        hero.style.setProperty("--sy", String(y));
      });
    };
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => { window.removeEventListener("scroll", on); cancelAnimationFrame(raf); };
  }, []);
  return null;
}
