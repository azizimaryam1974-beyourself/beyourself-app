import Link from "next/link";
import { SiteHeader } from "@/components/SiteChrome";
import { bookableLanguages } from "@/lib/languages";
import { formatPrice, LANGUAGE_PACKAGE_PRICE_CENTS } from "@/lib/language-package";
import { LiveDemo, type DemoLine } from "./LiveDemo";
import { Parallax } from "./Parallax";

export const dynamic = "force-dynamic";

/** Echte Ausgaben aus dem Live-Test vom 31.10.2026 (Claude, mit Fachbegriff-Liste). */
const DEMO: Record<string, string> = {
  tr: "İşaretsiz kavşaklarda sağdan gelenin önceliği vardır.",
  en: "At intersections without signs, priority to the right applies.",
  ru: "На перекрёстках без знаков действует помеха справа.",
  ar: "في التقاطعات بدون إشارات تسري الأولوية للقادم من اليمين.",
  es: "En los cruces sin señales rige la prioridad a la derecha.",
  fr: "Aux carrefours sans panneaux, la priorité à droite s’applique.",
  fa: "در چهارراه‌های بدون علامت، حق تقدم با سمت راست است.",
};

const CLASSES = [
  { k: "B", name: "Pkw", text: "Der klassische Führerschein für Auto bis 3,5 t. Mit Schaltwagen oder Automatik." },
  { k: "B197", name: "Automatik mit Schaltberechtigung", text: "Ausbildung überwiegend auf Automatik – und trotzdem darfst du später Schaltwagen fahren." },
  { k: "BE", name: "Anhänger", text: "Für Wohnwagen, Pferdeanhänger und alles, was mehr als 750 kg zieht." },
  { k: "Umschreibung", name: "Ausländischer Führerschein", text: "Du hast schon einen Führerschein aus dem Ausland? Wir bereiten dich gezielt auf die Prüfungen in Deutschland vor." },
];

export default function Home() {
  const langs = bookableLanguages();
  const demo: DemoLine[] = langs.map((l) => ({ code: l.code, label: l.labelDe, native: l.nativeLabel, rtl: l.rtl, text: DEMO[l.code] }));
  const price = formatPrice(LANGUAGE_PACKAGE_PRICE_CENTS).replace(",00", "");

  return (
    <>
      <Parallax />
      {/* ---------------- Kopfbereich ---------------- */}
      <section className="hero">
        <div className="hero-light" aria-hidden />
        <div className="hero-haze" aria-hidden />
        <svg className="hero-road" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" aria-hidden>
          <defs>
            <linearGradient id="road-gold" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0" stopColor="#9c7a3c" stopOpacity="0" />
              <stop offset="0.25" stopColor="#c6a465" />
              <stop offset="0.6" stopColor="#f1ddb0" />
              <stop offset="1" stopColor="#d99a3e" stopOpacity="0.2" />
            </linearGradient>
            <linearGradient id="road-teal" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0" stopColor="#5f9ea0" stopOpacity="0" />
              <stop offset="0.5" stopColor="#5f9ea0" stopOpacity="0.55" />
              <stop offset="1" stopColor="#a8c8db" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path className="road-shadow" d="M-60 900 C 260 893, 560 878, 820 820 S 1140 700, 1270 500 S 1400 170, 1520 110" />
          <path className="road-gold" d="M-60 900 C 260 893, 560 878, 820 820 S 1140 700, 1270 500 S 1400 170, 1520 110" />
          <path className="road-teal" d="M-60 930 C 300 925, 600 905, 860 855 S 1180 740, 1320 560 S 1440 240, 1540 180" />
        </svg>

        <SiteHeader tone="dark" />

        <div className="wrap hero-grid">
          <div className="hero-copy">
            <h1 className="slogan">Fahre deinen eigenen Weg.</h1>
            <p className="hero-sub">
              Führerschein bei beyourself: ruhig erklärt, in deinem Tempo – und der Theorieunterricht kommt live
              übersetzt auf dein Handy.
            </p>
            <div className="row">
              <Link href="/anmelden" className="btn btn-gold">Jetzt anmelden</Link>
              <a href="#klassen" className="btn btn-glass">Klassen ansehen</a>
            </div>
          </div>
          <LiveDemo lines={demo} />
        </div>
      </section>

      {/* ---------------- Bento ---------------- */}
      <section className="section cream" aria-labelledby="warum">
        <div className="wrap">
          <h2 id="warum" className="section-title">Alles, was du für deinen Führerschein brauchst. Nichts, was dich aufhält.</h2>
          <div className="bento">
            <article className="tile tile-dark tile-wide">
              <h3>Theorie in deiner Sprache</h3>
              <p>Die Lehrerin spricht Deutsch, du liest jeden Satz sofort übersetzt mit – oder hörst ihn über Kopfhörer.
                Fachbegriffe wie „rechts vor links“ stimmen, weil wir sie für jede Sprache festgelegt haben.</p>
              <div className="chips">
                {langs.map((l) => <span key={l.code} lang={l.code} dir={l.rtl ? "rtl" : "ltr"}>{l.nativeLabel}</span>)}
              </div>
            </article>
            <article className="tile tile-price">
              <span className="tile-price-num">{price}</span>
              <h3>Sprachpaket</h3>
              <p>Einmalig für die ganze Ausbildung, inkl. MwSt. Bei der Anmeldung dazubuchen.</p>
            </article>
            <article className="tile tile-sage">
              <h3>Fahrstunden, die zu dir passen</h3>
              <p>Termine abgestimmt auf Schule, Arbeit und Familie. Ruhig, klar, ohne Druck.</p>
            </article>
            <article className="tile tile-sky">
              <h3>Nachlesen, wann du willst</h3>
              <p>Jede Theoriestunde bleibt in deinem Konto – zum Wiederholen vor der Prüfung.</p>
            </article>
            <article className="tile tile-glass">
              <h3>Auch für Umschreiber</h3>
              <p>Führerschein aus dem Ausland? Wir zeigen dir genau, was in Deutschland anders ist.</p>
            </article>
          </div>
        </div>
      </section>

      {/* ---------------- Klassen ---------------- */}
      <section id="klassen" className="section cream-2" aria-labelledby="klassen-h">
        <div className="wrap">
          <div className="split-head">
            <h2 id="klassen-h" className="section-title">Führerscheinklassen</h2>
            <p className="lead">Preise erfährst du persönlich – sie hängen davon ab, was du schon kannst. Schreib uns oder komm vorbei.</p>
          </div>
          <div className="classes">
            {CLASSES.map((c) => (
              <article key={c.k} className="class-card">
                <span className={`class-k ${c.k.length > 5 ? "class-k-long" : ""}`}>{c.k}</span>
                <div>
                  <h3>{c.name}</h3>
                  <p>{c.text}</p>
                </div>
                <a className="class-link" href="#kontakt" aria-label={`Preis für ${c.name} anfragen`}>Preis anfragen</a>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- Sprachen / Ablauf ---------------- */}
      <section id="sprachen" className="section dark-band" aria-labelledby="sprachen-h">
        <div className="wrap">
          <h2 id="sprachen-h" className="section-title light">So liest du den Unterricht in deiner Sprache</h2>
          <ol className="steps">
            <li>
              <h3>Sprachpaket wählen</h3>
              <p>Bei der Anmeldung „Mit Sprachpaket“ und deine Sprache auswählen. {price}, einmalig.</p>
            </li>
            <li>
              <h3>Stunde öffnen</h3>
              <p>Im Unterricht auf dem Handy „Mein Konto“ öffnen und die laufende Stunde antippen.</p>
            </li>
            <li>
              <h3>Mitlesen oder zuhören</h3>
              <p>Jeder Satz erscheint übersetzt, das Deutsche darunter. Mit „Vorlesen“ hörst du ihn über Kopfhörer.</p>
            </li>
          </ol>
          <div className="lang-ribbon" aria-label="Verfügbare Sprachen">
            {langs.map((l) => <span key={l.code} lang={l.code} dir={l.rtl ? "rtl" : "ltr"}>{l.nativeLabel}</span>)}
          </div>
        </div>
      </section>

      {/* ---------------- Über uns ---------------- */}
      <section id="ueber-uns" className="section cream" aria-labelledby="ueber-h">
        <div className="wrap about">
          <div className="about-photo" role="img" aria-label="Platz für ein Foto der Fahrschule">
            <span>Foto folgt</span>
          </div>
          <div className="about-copy">
            <h2 id="ueber-h" className="section-title">Eine Fahrschule, die dir zuhört</h2>
            <p className="lead">Bei beyourself lernst du nicht nach Schema F. Wir schauen, wo du stehst, erklären geduldig
              und so lange, bis es sitzt – egal, welche Sprache du zu Hause sprichst.</p>
            <p>Unser Ziel ist nicht nur die bestandene Prüfung, sondern dass du danach sicher und gelassen
              fährst. Deinen eigenen Weg eben.</p>
          </div>
        </div>
      </section>

      {/* ---------------- Kontakt ---------------- */}
      <section id="kontakt" className="section sage-band" aria-labelledby="kontakt-h">
        <div className="wrap contact">
          <div>
            <h2 id="kontakt-h" className="section-title">Lass uns reden</h2>
            <p className="lead">Fragen zu Klassen, Preisen oder dem Sprachpaket? Schreib uns – wir melden uns schnell.</p>
            <div className="row">
              <a className="btn" href="mailto:info@fahrschule-beyourself.de">E-Mail schreiben</a>
              <Link className="btn btn-secondary" href="/anmelden">Direkt anmelden</Link>
            </div>
          </div>
          <dl className="contact-card">
            <div><dt>E-Mail</dt><dd><a href="mailto:info@fahrschule-beyourself.de">info@fahrschule-beyourself.de</a></dd></div>
            <div><dt>Telefon</dt><dd>folgt</dd></div>
            <div><dt>Adresse</dt><dd>folgt</dd></div>
            <div><dt>Bürozeiten</dt><dd>folgt</dd></div>
          </dl>
        </div>
      </section>
    </>
  );
}
