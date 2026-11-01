"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * Handy: schwebende Leiste unten (wie Instagram) – Glas, man sieht den Inhalt leicht durch.
 * Beim Scrollen wird sie kleiner, bleibt man stehen, wird sie wieder groß.
 */
export type BottomIcon = "home" | "cal" | "people" | "live" | "car" | "chat" | "more";
export interface BottomItem { href: string; label: string; icon: BottomIcon; match?: string[]; dot?: boolean }

const ICONS: Record<BottomIcon, React.ReactNode> = {
  home: <path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1Z" />,
  cal: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  people: <path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7 1a3 3 0 1 0 0-6M3 21c0-3.3 2.7-6 6-6s6 2.7 6 6m2-6c2.5.3 4 2.5 4 5" />,
  live: <><rect x="3" y="6" width="13" height="12" rx="3" /><path d="m16 10 5-3v10l-5-3" /></>,
  car: <><path d="M5 16h14M6.5 16l1.5-5h8l1.5 5M5 16v3h2v-2M19 16v3h-2v-2" /><circle cx="8" cy="16" r="0.5" /><circle cx="16" cy="16" r="0.5" /></>,
  chat: <path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-5 4V6a1 1 0 0 1 1-1Z" />,
  more: <><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></>,
};

export function BottomNav({ items, children }: { items: BottomItem[]; children?: React.ReactNode }) {
  const path = usePathname();
  const [mini, setMini] = useState(false);
  const [more, setMore] = useState(false);
  const t = useRef<number | undefined>(undefined);
  useEffect(() => setMore(false), [path]);
  useEffect(() => {
    let last = window.scrollY;
    const on = () => {
      const y = window.scrollY;
      if (Math.abs(y - last) > 4) setMini(true);
      last = y;
      window.clearTimeout(t.current);
      t.current = window.setTimeout(() => setMini(false), 350);
    };
    window.addEventListener("scroll", on, { passive: true });
    return () => { window.removeEventListener("scroll", on); window.clearTimeout(t.current); };
  }, []);
  const isOn = (it: BottomItem) => (it.match ?? [it.href]).some((m) =>
    m === "/verwaltung" ? path === m || path.startsWith("/verwaltung/schueler") : path === m || path.startsWith(m + "/"));
  return (
    <>
      {more && <button type="button" className="bnav-shade" aria-label="Menü schließen" onClick={() => setMore(false)} />}
      {more && <div className="bnav-more" role="menu">{children}</div>}
      <nav className={`bnav ${mini ? "mini" : ""}`} aria-label="Menü">
        {items.map((it) => (
          <Link key={it.href} href={it.href} className={isOn(it) ? "on" : ""} aria-current={isOn(it) ? "page" : undefined}>
            <span className="bnav-ico"><svg viewBox="0 0 24 24" aria-hidden>{ICONS[it.icon]}</svg>{it.dot && <i />}</span>
            <span className="bnav-label">{it.label}</span>
          </Link>
        ))}
        <button type="button" className={more ? "on" : ""} aria-expanded={more} onClick={() => setMore((m) => !m)}>
          <span className="bnav-ico"><svg viewBox="0 0 24 24" aria-hidden>{ICONS.more}</svg></span>
          <span className="bnav-label">Mehr</span>
        </button>
      </nav>
    </>
  );
}
