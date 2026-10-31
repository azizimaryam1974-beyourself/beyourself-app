import Link from "next/link";
import { currentUser } from "@/lib/server/auth";
import { logoutAction } from "@/app/actions";
import { Brand } from "./Brand";

export async function SiteHeader({ tone = "light" }: { tone?: "light" | "dark" }) {
  const user = await currentUser();
  return (
    <header className={`site-header ${tone === "dark" ? "dark" : ""}`}>
      <div className="wrap">
        <div className="bar">
          <Link href="/" aria-label="Startseite" style={{ textDecoration: "none" }}>
            <Brand sub={false} id={tone} />
          </Link>
          <nav className="nav" aria-label="Hauptmenü">
            <span className="nav-links">
              <Link href="/#klassen">Klassen</Link>
              <Link href="/#sprachen">Sprachen</Link>
              <Link href="/#ueber-uns">Über uns</Link>
              <Link href="/#kontakt">Kontakt</Link>
            </span>
            {user?.role === "teacher" && (
              <>
                <Link href="/verwaltung/kalender">Kalender</Link>
                <Link href="/unterricht">Unterricht</Link>
                <Link href="/verwaltung">Verwaltung</Link>
              </>
            )}
            {user?.role === "student" && (
              <>
                <Link href="/termine">Termine</Link>
                <Link href="/konto">Mein Konto</Link>
              </>
            )}
            {user ? (
              <form action={logoutAction}>
                <button type="submit">Abmelden</button>
              </form>
            ) : (
              <>
                <Link href="/login">Login</Link>
                <Link href="/anmelden" className="btn btn-gold btn-small" style={{ marginLeft: 4 }}>Anmelden</Link>
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
            <a href="/anmelden">Anmelden</a>
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
