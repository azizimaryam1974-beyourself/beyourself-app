import Link from "next/link";
import { db } from "@/lib/server/db";
import { listBookingsByStatus } from "@/lib/server/booking";

const TABS = [
  { href: "/verwaltung/kalender", label: "Kalender" },
  { href: "/verwaltung/arbeitszeiten", label: "Arbeitszeiten" },
  { href: "/verwaltung", label: "Schüler" },
  { href: "/verwaltung/angebote", label: "Angebote & Preise" },
  { href: "/verwaltung/einstellungen", label: "Vorlagen & Regeln" },
];

export function AdminTabs({ active }: { active: string }) {
  const open = listBookingsByStatus(db(), ["requested"]).length;
  return (
    <nav className="admin-tabs" aria-label="Verwaltung">
      {TABS.map((t) => (
        <Link key={t.href} href={t.href} className={t.href === active ? "on" : ""} aria-current={t.href === active ? "page" : undefined}>
          {t.label}
          {t.href === "/verwaltung/kalender" && open > 0 && <span className="tab-count" aria-label={`${open} offene Anfragen`}>{open}</span>}
        </Link>
      ))}
    </nav>
  );
}
