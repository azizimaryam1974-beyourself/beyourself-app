import Link from "next/link";
import { bookableLanguages } from "@/lib/languages";
import { formatPrice, LANGUAGE_PACKAGE_PRICE_CENTS } from "@/lib/language-package";

export default function Home() {
  const langs = bookableLanguages();
  return (
    <>
      <section className="hero">
        <h1>Theorie verstehen – in deiner Sprache.</h1>
        <p>
          Im Theorieunterricht spricht die Lehrerin Deutsch. Mit dem Sprachpaket liest du jeden Satz
          live auf deinem Handy mit – übersetzt und auf Wunsch vorgelesen.
        </p>
        <div className="flags" aria-label="Verfügbare Sprachen">
          {langs.map((l) => (
            <span key={l.code} lang={l.code} dir={l.rtl ? "rtl" : "ltr"}>{l.nativeLabel}</span>
          ))}
        </div>
        <div className="row">
          <Link href="/anmelden" className="btn">Jetzt anmelden</Link>
          <Link href="/login" className="btn btn-secondary">Ich habe schon ein Konto</Link>
        </div>
      </section>

      <div className="grid grid-2" style={{ marginTop: 32 }}>
        <div className="card">
          <h2>Sprachpaket</h2>
          <p className="price">{formatPrice(LANGUAGE_PACKAGE_PRICE_CENTS)}</p>
          <p>Einmalig für deine gesamte Ausbildung, inkl. MwSt. Wählbar direkt bei der Anmeldung.</p>
        </div>
        <div className="card">
          <h2>So funktioniert’s</h2>
          <ol style={{ margin: 0, paddingLeft: 20 }}>
            <li>Bei der Anmeldung Sprachpaket und Sprache wählen.</li>
            <li>Im Unterricht „Mein Konto“ öffnen und die laufende Stunde antippen.</li>
            <li>Mitlesen – oder mit Kopfhörern vorlesen lassen.</li>
          </ol>
        </div>
      </div>
    </>
  );
}
