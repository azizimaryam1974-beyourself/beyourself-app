import Link from "next/link";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";

export default function NotFound() {
  return (
    <>
      <div className="app-main">
        <SiteHeader />
        <main className="wrap narrow" style={{ paddingTop: 60 }}>
          <div className="card">
            <h1>Diese Seite gibt es nicht.</h1>
            <p>Vielleicht wurde der Link geändert. Von der Startseite aus findest du alles wieder.</p>
            <Link className="btn" href="/">Zur Startseite</Link>
          </div>
        </main>
      </div>
      <SiteFooter />
    </>
  );
}
