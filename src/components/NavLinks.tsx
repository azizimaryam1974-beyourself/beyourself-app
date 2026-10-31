"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface NavItem { href: string; label: string; match?: string[]; badge?: number }

/** Menüpunkte mit Markierung der aktuellen Seite. */
export function NavLinks({ items }: { items: NavItem[] }) {
  const path = usePathname();
  const active = (it: NavItem) => (it.match ?? [it.href]).some((m) => (m === "/verwaltung" ? path === m || path.startsWith("/verwaltung/schueler") : path === m || path.startsWith(m + "/")));
  return (
    <>
      {items.map((it) => (
        <Link key={it.href} href={it.href} className={active(it) ? "nav-on" : ""} aria-current={active(it) ? "page" : undefined}>
          {it.label}{it.badge ? <span className="tab-count" style={{ marginLeft: 6 }}>{it.badge}</span> : null}
        </Link>
      ))}
    </>
  );
}
