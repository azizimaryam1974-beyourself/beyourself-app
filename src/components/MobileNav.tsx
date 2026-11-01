"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { NavItem } from "./NavLinks";

/** Handy: statt einer langen Menüleiste ein Knopf „Menü“, der die Punkte aufklappt. */
export function MobileNav({ items, children }: { items: NavItem[]; children?: React.ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
  const isOn = (it: NavItem) => (it.match ?? [it.href]).some((m) => (m === "/verwaltung" ? path === m || path.startsWith("/verwaltung/schueler") : path === m || path.startsWith(m + "/")));
  const current = items.find(isOn);
  const badges = items.reduce((a, it) => a + (it.badge ?? 0), 0);
  return (
    <div className="mnav">
      <button type="button" className="mnav-btn" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span>{current?.label ?? "Menü"}</span>
        {badges > 0 && <span className="tab-count">{badges}</span>}
        <span aria-hidden className={`mnav-ico ${open ? "x" : ""}`}><i /><i /><i /></span>
      </button>
      {open && (
        <div className="mnav-panel">
          {items.map((it) => (
            <Link key={it.href} href={it.href} className={isOn(it) ? "on" : ""}>
              {it.label}{it.badge ? <span className="tab-count" style={{ marginLeft: 6 }}>{it.badge}</span> : null}
            </Link>
          ))}
          <div className="mnav-extra">{children}</div>
        </div>
      )}
    </div>
  );
}
