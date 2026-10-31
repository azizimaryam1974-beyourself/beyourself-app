"use client";

import { useEffect } from "react";

/** Setzt --sy (Scrollposition) für dezente Parallax-Ebenen im Kopfbereich. */
export function Parallax() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const on = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => document.documentElement.style.setProperty("--sy", String(Math.min(window.scrollY, 900))));
    };
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => { window.removeEventListener("scroll", on); cancelAnimationFrame(raf); };
  }, []);
  return null;
}
