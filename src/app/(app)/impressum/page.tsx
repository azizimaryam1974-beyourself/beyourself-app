export const metadata = { title: "Impressum" };
export default function Impressum() {
  return (
    <div className="card">
      <h1>Impressum</h1>
      <div className="alert alert-info">VORLAGE – vor dem Livegang mit den echten Angaben füllen (§ 5 DDG).</div>
      <p>Fahrschule Be Yourself<br />Inhaberin: [Vor- und Nachname]<br />[Straße Nr.]<br />[PLZ Ort]</p>
      <p>Telefon: [Telefon]<br />E-Mail: [E-Mail]</p>
      <p>USt-IdNr.: [falls vorhanden]<br />Fahrschulerlaubnis erteilt durch: [zuständige Behörde]</p>
    </div>
  );
}
