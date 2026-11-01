import Link from "next/link";
import { currentUser } from "@/lib/server/auth";
import { logoutAction } from "@/app/actions";
import { Brand } from "./Brand";
import { NavLinks, type NavItem } from "./NavLinks";
import { MobileNav } from "./MobileNav";
import { db } from "@/lib/server/db";
import { listBookingsByStatus } from "@/lib/server/booking";

export async function SiteHeader({ tone = "light" }: { tone?: "light" | "dark" }) {
  const user = await currentUser();
  // Eingeloggt: nur das eigene Arbeits-Menü. Besucher: das Menü der Webseite.
  const teacherOpen = user?.role === "teacher" ? listBookingsByStatus(db(), ["requested"]).length : 0;
  const items: NavItem[] = user?.role === "teacher"
    ? [
        { href: "/verwaltung/uebersicht", label: "Übersicht" },
        { href: "/verwaltung/kalender", label: "Kalender", badge: teacherOpen },
        { href: "/verwaltung", label: "Schüler" },
        { href: "/unterricht", label: "Live-Unterricht" },
        { href: "/verwaltung/einstellungen", label: "Einstellungen" },
      ]
    : user?.role === "student"
      ? [
          { href: "/termine", label: "Fahrstunden" },
          { href: "/theorie", label: "Theorie", match: ["/theorie", "/live"] },
          { href: "/konto", label: "Mein Konto" },
        ]
      : [];
  return (
    <header className={`site-header ${tone === "dark" ? "dark" : ""}`}>
      <div className="wrap">
        <div className="bar">
          <Link href="/" aria-label="Zur Startseite der Webseite" style={{ textDecoration: "none" }}>
            <Brand sub={false} id={tone} />
          </Link>
          {user && (
            <MobileNav items={items}>
              <Link href="/">Webseite</Link>
              <form action={logoutAction}><button type="submit">Abmelden</button></form>
            </MobileNav>
          )}
          <nav className={`nav ${user ? "nav-user" : ""}`} aria-label="Hauptmenü">
            {user ? (
              <>
                <NavLinks items={items} />
                <Link href="/" className="nav-quiet">Webseite</Link>
                <form action={logoutAction}>
                  <button type="submit" className="nav-quiet">Abmelden</button>
                </form>
              </>
            ) : (
              <>
                <span className="nav-links">
                  <Link href="/#klassen">Klassen</Link>
                  <Link href="/#sprachen">Sprachen</Link>
                  <Link href="/#ueber-uns">Über uns</Link>
                  <Link href="/#kontakt">Kontakt</Link>
                </span>
                <Link href="/login">Einloggen</Link>
                <Link href="/anmelden" className="btn btn-gold btn-small" style={{ marginLeft: 4 }}>Fahrschüler werden</Link>
              </>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="wrap">
        <div className="cols">
          <div>
            <Brand id="footer" />
            <p style={{ marginTop: 18, maxWidth: "34ch" }}>Fahre deinen eigenen Weg. Theorie live übersetzt in deine Sprache.</p>
          </div>
          <div>
            <a href="/#klassen">Klassen und Preise</a>
            <a href="/#sprachen">Live-Übersetzung</a>
            <a href="/#kontakt">Kontakt</a>
            <a href="/anmelden">Fahrschüler werden</a><a href="/login">Einloggen</a>
          </div>
          <div>
            <a href="mailto:info@fahrschule-beyourself.de">info@fahrschule-beyourself.de</a>
            <a href="/impressum">Impressum</a>
            <a href="/datenschutz">Datenschutz</a>
            <a href="/sprachpaket">Sprachpaket-Bedingungen</a>
          </div>
        </div>
        <div className="legal">© {new Date().getFullYear()} Fahrschule beyourself</div>
      </div>
    </footer>
  );
}

/** Im eingeloggten Bereich: nur eine schlichte Zeile statt der Webseiten-Fußzeile. */
export function AppFooter() {
  return (
    <footer className="app-footer">
      <div className="wrap">
        <span>© {new Date().getFullYear()} Fahrschule beyourself</span>
        <a href="/impressum">Impressum</a>
        <a href="/datenschutz">Datenschutz</a>
      </div>
    </footer>
  );
}
