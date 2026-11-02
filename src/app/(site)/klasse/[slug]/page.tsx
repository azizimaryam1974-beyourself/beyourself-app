import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/SiteChrome";
import { getLicenseClass, LICENSE_CLASSES, VIDEO } from "@/lib/classes";
import { formatPrice, LANGUAGE_PACKAGE_PRICE_CENTS } from "@/lib/language-package";
import { BgVideo } from "./BgVideo";
import { breadcrumbJsonLd, JsonLd } from "@/lib/seo";
import { SCHOOL } from "@/lib/school";

export function generateStaticParams() {
  return LICENSE_CLASSES.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const c = getLicenseClass((await params).slug);
  if (!c) return { title: "Klasse" };
  return {
    title: `Führerschein Klasse ${c.k} in Kassel – ${c.name}`,
    description: `${c.short} Fahrschule beyourself, ${SCHOOL.street}, Kassel. Fahrstunden online buchen, Theorie auf Wunsch live übersetzt.`,
    alternates: { canonical: `/klasse/${c.slug}` },
    openGraph: { title: `Klasse ${c.k} in Kassel – ${c.name} | Fahrschule beyourself`, description: c.short, url: `/klasse/${c.slug}` },
  };
}

const INCLUDED = [
  { t: "Theorie", d: "Unterricht vor Ort – mit Sprachpaket live übersetzt auf dein Handy." },
  { t: "Fahrstunden", d: "Übungsfahrten in deinem Tempo, Termine passend zu deinem Alltag." },
  { t: "Sonderfahrten", d: "Überland, Autobahn und Nachtfahrt – so, wie es die Ausbildung vorschreibt." },
  { t: "Prüfung", d: "Gezielte Vorbereitung auf Theorie- und Praxisprüfung." },
];

export default async function ClassPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = getLicenseClass(slug);
  if (!c) notFound();
  const others = LICENSE_CLASSES.filter((o) => o.slug !== c.slug);

  return (
    <section className="class-page">
      <BgVideo src={VIDEO.background(c.slug)} tone={c.turn} />
      <SiteHeader tone="dark" />
      <div className="wrap class-content">
        <Link href="/#top" className="back-link">← Zurück zur Kreuzung</Link>
        <div className="class-hero">
          <span className="street-sign as-label">{c.sign}</span>
          <h1 className="class-title">{c.name}</h1>
          <p className="class-lead">{c.short}</p>
        </div>

        <div className="class-grid">
          <div className="glass-panel">
            {c.long.map((p, i) => <p key={i}>{p}</p>)}
            <div className="row" style={{ marginTop: 22 }}>
              <Link href={`/anmelden?klasse=${c.slug}`} className="btn btn-gold">Für Klasse {c.k} anmelden</Link>
              <a href={`mailto:${SCHOOL.email}`} className="btn btn-glass">Preis anfragen</a>
            </div>
          </div>
          <ul className="included">
            {INCLUDED.map((x) => (
              <li key={x.t} className="glass-panel small">
                <h3>{x.t}</h3>
                <p>{x.d}</p>
              </li>
            ))}
            <li className="glass-panel small gold">
              <h3>Sprachpaket {formatPrice(LANGUAGE_PACKAGE_PRICE_CENTS).replace(",00", "")}</h3>
              <p>Theorie in deiner Sprache – einmalig für die ganze Ausbildung.</p>
            </li>
          </ul>
        </div>

        <JsonLd data={breadcrumbJsonLd([{ name: "Fahrschule beyourself Kassel", path: "/" }, { name: `Klasse ${c.k}`, path: `/klasse/${c.slug}` }])} />
        <JsonLd data={{ "@context": "https://schema.org", "@type": "Service", name: `Führerschein Klasse ${c.k} – ${c.name}`, description: [c.short, ...c.long].join(" "),
          provider: { "@id": `${SCHOOL.url}/#fahrschule` }, areaServed: SCHOOL.city, url: `${SCHOOL.url}/klasse/${c.slug}` }} />
        <nav className="other-streets" aria-label="Andere Klassen">
          <span>Andere Straßen:</span>
          {others.map((o) => <Link key={o.slug} href={`/klasse/${o.slug}`} className="street-sign as-link">{o.sign}</Link>)}
        </nav>
      </div>
    </section>
  );
}
