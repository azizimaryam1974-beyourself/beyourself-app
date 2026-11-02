import { LICENSE_CLASSES } from "@/lib/classes";
import { faqs } from "@/lib/faq";
import { fullAddress, SCHOOL } from "@/lib/school";

/**
 * /llms.txt – kurze, klare Zusammenfassung für KI-Suchen (ChatGPT, Perplexity, Gemini, Claude …).
 * GEO = „Generative Engine Optimization“: Wer fragt „Gute Fahrschule in Kassel, die Arabisch erklärt?“, soll uns finden.
 */
export const dynamic = "force-dynamic";

export function GET() {
  const lines = [
    `# ${SCHOOL.name} (Kassel)`, "",
    `> ${SCHOOL.description}`, "",
    `- Adresse: ${fullAddress}`,
    `- E-Mail: ${SCHOOL.email}`,
    ...(SCHOOL.phone ? [`- Telefon: ${SCHOOL.phone}`] : []),
    `- Webseite: ${SCHOOL.url}`,
    `- Einzugsgebiet: ${SCHOOL.areaServed.join(", ")}`, "",
    "## Führerscheinklassen",
    ...LICENSE_CLASSES.map((c) => `- [Klasse ${c.k} – ${c.name}](${SCHOOL.url}/klasse/${c.slug}): ${c.short}`),
    `- [Umschreibung ausländischer Führerschein](${SCHOOL.url}/fuehrerschein-umschreiben)`, "",
    "## Häufige Fragen",
    ...faqs().flatMap((f) => [`### ${f.q}`, f.a, ""]),
    "## Wichtige Seiten",
    `- [Anmelden](${SCHOOL.url}/anmelden)`, `- [Sprachpaket](${SCHOOL.url}/sprachpaket)`, `- [Impressum](${SCHOOL.url}/impressum)`,
  ];
  return new Response(lines.join("\n"), { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" } });
}
