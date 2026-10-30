import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import { currentUser } from "@/lib/server/auth";
import { logoutAction } from "./actions";

export const metadata: Metadata = {
  title: { default: "Fahrschule Be Yourself", template: "%s · Fahrschule Be Yourself" },
  description: "Theorieunterricht mit Live-Übersetzung in deiner Sprache.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0f5f5c" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  return (
    <html lang="de">
      <body>
        <header className="topbar">
          <div className="wrap">
            <Link href="/" className="logo">
              <span className="logo-mark" aria-hidden>BY</span>
              <span>
                Be Yourself
                <small>Fahrschule</small>
              </span>
            </Link>
            <nav className="nav" aria-label="Hauptmenü">
              {user?.role === "teacher" && (
                <>
                  <Link href="/unterricht">Unterricht</Link>
                  <Link href="/verwaltung">Verwaltung</Link>
                </>
              )}
              {user?.role === "student" && <Link href="/konto">Mein Konto</Link>}
              {user ? (
                <form action={logoutAction}>
                  <button type="submit">Abmelden</button>
                </form>
              ) : (
                <>
                  <Link href="/login">Login</Link>
                  <Link href="/anmelden" className="btn btn-small">Anmelden</Link>
                </>
              )}
            </nav>
          </div>
        </header>
        <main>
          <div className="wrap">{children}</div>
        </main>
        <footer className="footer">
          <div className="wrap">
            <Link href="/impressum">Impressum</Link>
            <Link href="/datenschutz">Datenschutz</Link>
            <Link href="/sprachpaket">Sprachpaket-Bedingungen</Link>
          </div>
        </footer>
      </body>
    </html>
  );
}
