import { SCHOOL } from "@/lib/school";

export const dynamic = "force-dynamic";
export const metadata = { title: "Impressum", description: "Impressum der Fahrschule beyourself, Kassel.", alternates: { canonical: "/impressum" }, robots: { index: true, follow: true } };

/** Angaben nach § 5 DDG. Inhaberin und Telefon kommen aus der Server-Einstellung (.env: SCHOOL_OWNER, SCHOOL_PHONE). */
export default function Impressum() {
  const missing = !SCHOOL.owner || !SCHOOL.phone;
  return (
    <div className="card">
      <h1>Impressum</h1>
      {missing && <div className="alert alert-info">Noch unvollständig – Inhaberin und Telefon werden ergänzt. Vor dem Start mit echten Kunden vom Anwalt prüfen lassen (§ 5 DDG).</div>}
      <p>{SCHOOL.name}<br />{SCHOOL.owner ? <>Inhaberin: {SCHOOL.owner}<br /></> : null}{SCHOOL.street}<br />{SCHOOL.zip} {SCHOOL.city}</p>
      <p>{SCHOOL.phone ? <>Telefon: {SCHOOL.phone}<br /></> : null}E-Mail: <a href={`mailto:${SCHOOL.email}`}>{SCHOOL.email}</a></p>
      {process.env.SCHOOL_VAT_ID && <p>USt-IdNr.: {process.env.SCHOOL_VAT_ID}</p>}
      <p>Fahrschulerlaubnis erteilt durch: {process.env.SCHOOL_PERMIT_AUTHORITY || "[zuständige Erlaubnisbehörde – wird ergänzt]"}</p>
    </div>
  );
}
