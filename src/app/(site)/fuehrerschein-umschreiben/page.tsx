import Link from "next/link";
import { SiteHeader } from "@/components/SiteChrome";
import { VIDEO } from "@/lib/classes";
import { breadcrumbJsonLd, faqJsonLd, JsonLd } from "@/lib/seo";
import { SCHOOL } from "@/lib/school";
import { BgVideo } from "../klasse/[slug]/BgVideo";

export const metadata = {
  title: "Führerschein umschreiben in Kassel – ausländischen Führerschein umschreiben lassen",
  description: "Ausländischen Führerschein in Kassel umschreiben: Welche Unterlagen die Führerscheinstelle Kassel verlangt, was es kostet und wie dich die Fahrschule beyourself auf die Prüfungen vorbereitet – auf Wunsch mit Theorie in deiner Sprache.",
  alternates: { canonical: "/fuehrerschein-umschreiben" },
};

/** Angaben der Stadt Kassel (kassel.de, „Ausländischer Führerschein“, Stand 11/2026). */
const QA = [
  { q: "Wo stelle ich den Antrag auf Umschreibung in Kassel?",
    a: "Persönlich bei der Führerscheinstelle der Stadt Kassel (Bürgeramt). Die Sachbearbeitung sagt dir, ob du eine theoretische und/oder praktische Prüfung brauchst – das hängt vom Land ab, in dem du deinen Führerschein gemacht hast." },
  { q: "Welche Unterlagen brauche ich?",
    a: "Laut Stadt Kassel: einen gültigen Personalausweis oder Reisepass bzw. ausländischen Pass mit deinem elektronischen Aufenthaltstitel, ein aktuelles biometrisches Passbild auf Papier (45 × 35 mm) und deinen ausländischen Führerschein. Im Einzelfall kann die Behörde mehr verlangen, z. B. eine Übersetzung." },
  { q: "Was kostet die Umschreibung bei der Stadt?",
    a: "Die Stadt Kassel nennt 37,50 € ohne und 45,10 € mit Befähigungsprüfung, für die Schaltkompetenz (B197) ggf. 28,60 € zusätzlich. Bezahlt wird bei Antragstellung mit Girocard oder bar. Dazu kommen die Kosten für Fahrstunden und Prüfungen bei uns." },
  { q: "Wie bereitet mich beyourself vor?",
    a: "Wir schauen in einer ersten Fahrt, was du schon kannst, und üben gezielt, was in Deutschland anders ist: Vorfahrtsregeln, Verkehrszeichen, Stadtverkehr und Prüfungsablauf. Den Theorieunterricht kannst du mit dem Sprachpaket live übersetzt mitlesen." },
];

export default function UmschreibungPage() {
  return (
    <section className="class-page">
      <BgVideo src={VIDEO.background("b78")} tone="straight" />
      <SiteHeader tone="dark" />
      <div className="wrap class-content">
        <Link href="/#klassen" className="back-link">← Alle Klassen</Link>
        <div className="class-hero">
          <span className="street-sign as-label">Umschreibung</span>
          <h1 className="class-title">Führerschein umschreiben in Kassel</h1>
          <p className="class-lead">Du hast schon einen Führerschein aus dem Ausland? Wir bereiten dich gezielt auf die Prüfungen in Deutschland vor – geduldig und, wenn du möchtest, mit Theorie in deiner Sprache.</p>
        </div>
        <div className="class-grid">
          <div className="glass-panel">
            {QA.map((x) => (<div key={x.q} style={{ marginBottom: 18 }}><h2 style={{ fontSize: "1.15rem", margin: "0 0 6px" }}>{x.q}</h2><p style={{ margin: 0 }}>{x.a}</p></div>))}
            <p className="hint" style={{ marginTop: 10 }}>Quelle: Stadt Kassel, „Ausländischer Führerschein“. Angaben ohne Gewähr – bitte vor dem Termin bei der Stadt prüfen.</p>
            <div className="row" style={{ marginTop: 22 }}>
              <Link href="/anmelden?klasse=umschreibung" className="btn btn-gold">Zur Umschreibung anmelden</Link>
              <a href={`mailto:${SCHOOL.email}`} className="btn btn-glass">Frage stellen</a>
            </div>
          </div>
          <ul className="included">
            <li className="glass-panel small"><h3>Erste Fahrt</h3><p>Wir sehen, was du schon kannst – und planen nur so viele Stunden wie nötig.</p></li>
            <li className="glass-panel small"><h3>Deutsche Regeln</h3><p>Rechts vor links, Verkehrszeichen, Stadt und Autobahn.</p></li>
            <li className="glass-panel small"><h3>Prüfung</h3><p>Prüfungsfahrt üben, bis du dich sicher fühlst.</p></li>
            <li className="glass-panel small gold"><h3>In deiner Sprache</h3><p>Theorieunterricht live übersetzt auf dein Handy.</p></li>
          </ul>
        </div>
      </div>
      <JsonLd data={breadcrumbJsonLd([{ name: "Fahrschule beyourself Kassel", path: "/" }, { name: "Führerschein umschreiben", path: "/fuehrerschein-umschreiben" }])} />
      <JsonLd data={faqJsonLd(QA)} />
    </section>
  );
}
