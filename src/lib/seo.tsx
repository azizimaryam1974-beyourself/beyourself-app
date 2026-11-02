import { bookableLanguages } from "./languages";
import { LICENSE_CLASSES } from "./classes";
import { SCHOOL } from "./school";
import type { Faq } from "./faq";

const DAY: Record<string, string> = { Mo: "Monday", Di: "Tuesday", Mi: "Wednesday", Do: "Thursday", Fr: "Friday", Sa: "Saturday", So: "Sunday" };

/** Schema.org-Daten: sagt Google, Bing und KI-Suchen genau, wer wir sind, wo wir sind und was wir anbieten. */
export function schoolJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "DrivingSchool",
    "@id": `${SCHOOL.url}/#fahrschule`,
    name: SCHOOL.name,
    alternateName: ["beyourself Fahrschule", "Fahrschule Be Yourself Kassel"],
    slogan: SCHOOL.slogan,
    description: SCHOOL.description,
    url: SCHOOL.url,
    logo: `${SCHOOL.url}/icon-512.png`,
    image: `${SCHOOL.url}/opengraph-image`,
    email: SCHOOL.email,
    ...(SCHOOL.phone ? { telephone: SCHOOL.phone } : {}),
    address: { "@type": "PostalAddress", streetAddress: SCHOOL.street, postalCode: SCHOOL.zip, addressLocality: SCHOOL.city, addressRegion: SCHOOL.region, addressCountry: SCHOOL.country },
    geo: { "@type": "GeoCoordinates", latitude: SCHOOL.geo.lat, longitude: SCHOOL.geo.lon },
    areaServed: SCHOOL.areaServed.map((c) => ({ "@type": "City", name: c })),
    knowsLanguage: ["de", ...bookableLanguages().map((l) => l.code)],
    ...(SCHOOL.hours.length ? { openingHoursSpecification: SCHOOL.hours.map((h) => ({ "@type": "OpeningHoursSpecification", dayOfWeek: h.days.map((d) => DAY[d]), opens: h.from, closes: h.to })) } : {}),
    ...(SCHOOL.sameAs.length ? { sameAs: SCHOOL.sameAs } : {}),
    hasOfferCatalog: {
      "@type": "OfferCatalog", name: "Führerscheinklassen",
      itemListElement: [
        ...LICENSE_CLASSES.map((c) => ({ "@type": "Offer", itemOffered: { "@type": "Service", name: `Führerschein Klasse ${c.k} – ${c.name}`, description: c.short, url: `${SCHOOL.url}/klasse/${c.slug}` } })),
        { "@type": "Offer", itemOffered: { "@type": "Service", name: "Umschreibung ausländischer Führerschein", url: `${SCHOOL.url}/fuehrerschein-umschreiben` } },
        { "@type": "Offer", itemOffered: { "@type": "Service", name: "Sprachpaket: Theorieunterricht live übersetzt", url: `${SCHOOL.url}/sprachpaket` } },
      ],
    },
  };
}

export function faqJsonLd(list: Faq[]) {
  return { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: list.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) };
}

export function breadcrumbJsonLd(items: Array<{ name: string; path: string }>) {
  return { "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: `${SCHOOL.url}${it.path}` })) };
}

/** <script type="application/ld+json"> – sicher eingebettet. */
export function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}
