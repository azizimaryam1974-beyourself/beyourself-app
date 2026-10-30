export const metadata = { title: "Datenschutz" };
export default function Datenschutz() {
  return (
    <div className="card">
      <h1>Datenschutzhinweise</h1>
      <div className="alert alert-info">VORLAGE – bitte rechtlich prüfen lassen und Verantwortliche/n eintragen.</div>
      <h2>Was wir speichern</h2>
      <p>Name, E-Mail, optional Telefonnummer, ein verschlüsseltes Passwort, dein gebuchtes Sprachpaket und die gewählte Sprache.
        Zweck: Durchführung deiner Ausbildung und des Sprachpakets (Art. 6 Abs. 1 lit. b DSGVO).</p>
      <h2>Live-Übersetzung</h2>
      <p>Im Theorieunterricht wird nur die Stimme der Lehrkraft über deren Mikrofon erfasst. Die Spracherkennung, Übersetzung und
        Vorlesestimme laufen über Microsoft Azure AI Services in Rechenzentren in Deutschland/EU (Region „Germany West Central“,
        europäischer Übersetzungs-Endpunkt). Mit Microsoft besteht ein Auftragsverarbeitungsvertrag (Data Protection Addendum).
        Microsoft speichert Audio und Texte dieser Dienste nicht zu eigenen Zwecken. Dein Mikrofon wird nie verwendet.</p>
      <p>Die Übersetzung der erkannten deutschen Sätze erfolgt mit dem KI-Modell Claude der Anthropic PBC (USA) über deren
        Programmierschnittstelle. Übermittelt wird nur der Text der Lehrkraft, keine Daten von Schülern. Grundlage sind ein
        Auftragsverarbeitungsvertrag und EU-Standardvertragsklauseln. [Bitte vor dem Livegang prüfen und Angaben bestätigen.]</p>
      <p>Die erkannten Sätze einer Stunde und ihre Übersetzungen speichern wir, damit du sie nachlesen kannst, und löschen sie nach [Frist, z. B. Ende der Ausbildung].</p>
      <h2>Cookies</h2>
      <p>Wir setzen nur ein technisch notwendiges Anmelde-Cookie. Keine Werbung, kein Tracking, keine externen Schriften.</p>
      <h2>Hosting</h2>
      <p>Die Website wird bei der IONOS SE, Elgendorfer Str. 57, 56410 Montabaur, auf Servern in Deutschland betrieben (Auftragsverarbeitung).</p>
      <h2>Deine Rechte</h2>
      <p>Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit, Widerspruch und Beschwerde bei einer Aufsichtsbehörde.
        Kontakt: [E-Mail der Fahrschule].</p>
    </div>
  );
}
