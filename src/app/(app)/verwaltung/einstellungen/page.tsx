import Link from "next/link";
import { requireTeacher } from "@/lib/server/auth";
import { PageHead } from "@/components/PageHead";

export const metadata = { title: "Einstellungen" };

const TILES = [
  { href: "/verwaltung/einstellungen/arbeitszeiten", icon: "🕘", title: "Arbeitszeiten & Urlaub", text: "Deine normale Woche, Pausen, Urlaub und freie Tage." },
  { href: "/verwaltung/einstellungen/preise", icon: "€", title: "Preise & Leistungen", text: "Was du anbietest, was es kostet und was dazugehört." },
  { href: "/verwaltung/einstellungen/vorlagen", icon: "✉", title: "Nachrichten-Vorlagen", text: "Fertige Texte für Bestätigung, Ablehnung und Absage." },
  { href: "/verwaltung/protokoll", icon: "🛡", title: "Protokoll", text: "Wer hat wann was gemacht – Logins, Buchungen, Zahlungen, Änderungen, Fehler." },
  { href: "/verwaltung/einstellungen/regeln", icon: "⚙", title: "Regeln & Verbindungen", text: "Zahlungsfrist, Absagefrist, Testfahrt-Länge, Zahlung und E-Mail." },
];

export default async function SettingsHub() {
  await requireTeacher();
  return (
    <>
      <PageHead title="Einstellungen" intro="Hier legst du einmal fest, wie deine Fahrschule arbeitet. Im Alltag brauchst du nur den Kalender." />
      <div className="tiles">
        {TILES.map((t) => (
          <Link key={t.href} href={t.href} className="tile-link">
            <span className="tile-icon" aria-hidden>{t.icon}</span>
            <span><strong>{t.title}</strong><span className="tile-text">{t.text}</span></span>
            <span className="tile-go" aria-hidden>→</span>
          </Link>
        ))}
      </div>
    </>
  );
}
