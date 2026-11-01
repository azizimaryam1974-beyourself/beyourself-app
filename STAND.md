# Stand & Merkliste – Fahrschule beyourself

**Stand: 01.11.2026, 00:50 Uhr.** Morgen hier weitermachen. Ergänzend: `ROADMAP.md` (Bausteine), `ARBEITSWEISE.md` (Ausbildungsablauf,
alle Entscheidungen), `KONZEPT-HYBRID-UNTERRICHT.md` (Theorie, Video, Aufnahme), `TODO-SICHERHEIT.md` (Sicherheit & Recht).

---

## 1. Server – was ist drauf?
Maryam hat zuletzt den Stand mit der aufgeräumten Verwaltung eingespielt (Screenshots 31.10., ca. 23:20).
**Danach entstanden und noch NICHT bestätigt auf dem Server:**
- Grundbetrag-Text „inklusive Theorie-App …“
- Live-Unterricht: Erklärung, Beenden in der Liste, vergessene Stunden enden automatisch, Live-Status nach Neustart
- Schritt 3: Absagen, Guthaben, Warteliste
- Theorie: Termine mit Anmeldung, Fragen mit Prüfung, Hand heben, Beamer-Ansicht

Einspielen: `cd /opt/beyourself && git pull && docker compose up -d --build`
**Ab Einrichtung des Auto-Updates (01.11., siehe README) nicht mehr nötig** – neue Versionen sind ca. 3–10 Min. nach dem Hochladen online.
→ Danach prüfen: Die alte LIVE-Stunde vom 31.10. muss innerhalb einer Minute auf „Beendet“ springen.

## 2. Gebaut, aber NOCH NICHT ECHT GETESTET
(Automatische Tests laufen: 89/89. Durchgespielt im Test-Browser mit Testkonten. Aber nicht mit echten Geräten/Diensten:)

| Bereich | Was fehlt zum echten Test |
|---|---|
| Startseite: Abbiege-Videos + „Zurück zur Kreuzung“ | Auf Maryams **iPhone und Laptop** mit echtem Video (Testbrowser kann H.264 nicht abspielen) |
| Online-Zahlung Stripe/PayPal | Konten fehlen noch → bisher nur „Test-Zahlung“ und „Bar/EC“ |
| E-Mails an Schüler/Fahrschule | IONOS-Mailpasswort fehlt in `.env` → Nachrichten nur im Konto |
| Fragen-Prüfung mit Claude | Nur mit simulierter Antwort getestet. Echt testen: harmlose Frage auf Türkisch/Arabisch, Beleidigung, Unsinn |
| Live-Unterricht + Fragen + Beamer | Auf echtem **LED/Beamer** (zweiter Bildschirm), 2 Handys als Schüler, Spracherkennung mit Azure |
| Live-Verbindung auf iPhone (Safari) | Fragen/Untertitel auf echtem iPhone |
| Warteliste | Nachrichten im echten Zeitablauf (30 Min, Nachtruhe 22–7 Uhr) |
| Absagen/Guthaben | Mit echter Zahlung (Stripe/PayPal) → Teil-Verrechnung mit Guthaben |
| Kalender | Mit echter Wochenvorlage von Maryam, Stunden durchstreichen am Handy |
| Beleuchtungsfahrt | Sommer-Zeiten (Sonnenuntergang ~21:40) – ob 15 Min Puffer passt |
| Daten-Umstellung (alte Angebote löschen) | Nur mit Kopie simuliert – auf dem echten Server beobachten |
| Schritt 4: Grundbetrag + Prüfungen (01.11.) | Mit Testkonto durchgespielt (Anmeldung → Grundbetrag → Einladung Praxis → bestätigt). Echt testen: mit einem Schüler, der schon im System ist („Schon bezahlt / erlassen“) |
| Übersicht (Dashboard, 01.11.) | Wetter (DWD über Bright Sky) konnte hier nicht abgerufen werden – auf dem Server prüfen. Zahlen mit echten Fahrten im Februar prüfen |
| Chat + Belege (01.11.) | Mit Testkonten durchgespielt (Anhang, Antworten, Leeren, Export-ZIP). Echt testen: Foto mit iPhone-Kamera (HEIC-Bilder zeigt der Browser evtl. nicht als Vorschau, Export geht) |
| Profilfoto + Pflichtangaben + Glocke (01.11.) | Mit Testkonten durchgespielt (Anmeldung mit Geburtstag/Adresse/Telefon, alte Schüler müssen nachtragen, Foto hochladen, Glocke mit Geburtstagen). Echt testen: Foto direkt mit iPhone-Kamera |
| Finanzen, Einzahlung aufs Guthaben, Tag verschieben (01.11.) | Mit Testkonten durchgespielt. Echt testen: Datumsfeld auf dem iPhone (Korrektur nur im Testbrowser geprüft), Bankverbindung eintragen sobald Geschäftskonto da |
| Expo-App (iPhone) | **Noch nie** auf Maryams Handy geöffnet; kennt Kalender/Theorie/Fragen noch nicht |

## 3. Entscheidungen von Maryam (Kurzfassung – Details in ARBEITSWEISE.md)
- Klassen: B (Schalter), B197, B78 (Automatik), Umschreibung. Kein BE/Anhänger.
- B197: 3 Std. Automatik → 10 Std. Schalter → Testfahrt → Sonderfahrten → Wiederholung (mind. 3) → Prüfung.
  B/B78: Übungsstunden legt Fahrlehrer fest → Sonderfahrten → Wiederholung → Prüfungsreife (Nachricht) → Prüfung.
  Umschreibung: ohne Sonderfahrten. Sonderfahrten: zuerst je ≥ 90 Min Überland + Autobahn, dann frei.
- Stunde = 45 Min. Buchbar 60/75/90 Min, Beleuchtung auch 135 Min. Preis **centgenau anteilig**.
- Preise: Übungsfahrt 68 €/45 Min, Sonderfahrt 75 €/45 Min, Testfahrt 30 Min 45 € (umschaltbar auf 45 Min/68 €),
  Warmstunde 30 Min 45 €, Grundbetrag 520 € (alle Klassen, mit Anmeldung, inkl. Theorie-App/Lernmaterial),
  Prüfung praktisch 200 € + TÜV 129,83 €, Theorie 70 € + TÜV 24,99 € (TÜV kassiert die Fahrschule und leitet weiter).
- Arbeitsrahmen Okt–Apr 9–21 Uhr, Mai–Sep 9–23 Uhr; keine Sonntage/Feiertage Hessen; Wochenvorlage + jeden Tag flexibel.
- Automatisch bestätigen nach Ausbildungsstand; „nur mit meiner Freigabe“ je Schüler möglich.
- Absagen: kostenlos bis 24 Std./spätestens 21 Uhr Vortag (Guthaben), danach 70 %, Last-Minute nicht absagbar,
  nicht erschienen/>15 Min zu spät 75 %, neu besetzt → alles zurück. Kein Geld zurück, sondern Guthaben.
- Warteliste: 1×/Woche, Platz 1 exklusiv 30 Min (immer), Nachtruhe 22–7, danach alle.
- Theorie: Name auf Beamer „Lona S.“; Hand heben + live sprechen (nur nach „Wort geben“) + schriftlich;
  Beleidigungen automatisch ausfiltern; Aufnahme ja; Kamera der Schüler zu Hause erst nach der Reform, Mikro an/aus.
- Mehrere Fahrschulen + weitere Admins mit Einzelrechten: gewünscht, technisch vorbereiten, später freischalten.

## 4. Offene Fragen an Maryam
1. **Video:** Weg A (LiveKit Cloud, ~50 $/Monat, US-Firma) oder B (eigener Video-Server in Deutschland, ~15–30 €/Monat + Speicher) – Empfehlung B, vorher evtl. 2–3 Gratis-Tests mit A.
2. **Aufnahmen sehen:** alle Schüler oder nur die Angemeldeten dieser Stunde? Löschfrist (Vorschlag 180 Tage)?
3. **Upload-Speed** in der Fahrschule messen (speedtest.net) → Wert schicken.
4. **Hardware kaufen:** Ansteck-Funkmikrofon (USB), Full-HD-Webcam + Stativ, HDMI-Kabel.
5. **Beleuchtungsfahrt:** Start 15 Min nach Sonnenuntergang ok? (Im Juni/Juli bleibt bis 23 Uhr wenig Zeit.)
6. **Geschäftskonto (Bank)** eröffnen → danach **Stripe** + **PayPal-Geschäftskonto** (gemeinsam, Schritt für Schritt). Stand 01.11.: noch kein Geschäftskonto.
7. **IONOS-Mailpasswort** in `.env` eintragen (gemeinsam).
8. **Echte Arbeitszeiten** (Wochenvorlage) eintragen.
9. Texte „Was ist enthalten“ bei Preise & Leistungen durchlesen.

## 5. Noch NICHT gebaut
- **Video + Aufnahme** (Konzept fertig, siehe KONZEPT-HYBRID-UNTERRICHT.md) inkl. „Wort geben“ mit Mikrofon.
- **E-Mail (IONOS) in der App (Wunsch 01.11.):** Lesen, Antworten, Signatur. Noch offen – Entscheidung von Maryam (siehe Chat 01.11.): großer Baustein, Passwort läge auf dem Server; Alternative: iPhone-Mail-App mit IONOS-Konto.
- **Belege: KI liest Betrag/Firma/Datum automatisch** (Claude Haiku Vision), sobald Anthropic-Konto wieder frei.
- **KI-Telefonassistent (Wunsch 01.11.):** beantwortet Anrufe und Fragen (Preise, Klassen, Termine, Anmeldung), leitet Wichtiges an Maryam weiter.
  Braucht: Telefonnummer (virtuelle Nummer möglich), Anbieter für Sprache/Telefonie, klare Ansage „Sie sprechen mit einer KI“, Datenschutz, Kostenlimit.
- **Konto selbst löschen (Pflicht für App Store, auch DSGVO):** Vorschlag: „Konto löschen“ unter Mein Konto → Konto sofort gesperrt (kein Login,
  keine Nachrichten), Persönliches gelöscht/anonymisiert. Was das Gesetz verlangt, bleibt gesperrt aufbewahrt (Rechnungen/Zahlungen 8–10 Jahre,
  Ausbildungsnachweis). Offene Beträge und gebuchte Termine bleiben bestehen (Löschen ≠ Vertrag kündigen) – vorher klare Warnung,
  Fahrschule bekommt Nachricht. Mit Anwalt abstimmen. Bauen zusammen mit der Handy-App.
- **Rollen & Rechte:** weitere Admins/Fahrlehrer einladen, jedes Recht einzeln (z. B. Termine ja, Zahlungen nein); je Fahrlehrer eigener Kalender.
- **Mehrere Fahrschulen** (technisch vorbereiten, erst nach einigen Monaten Betrieb freischalten).
- **Sonderfahrten-Zahlen einstellbar** (Reform 21/7404 schafft feste 5/4/3 evtl. ab).
- **Rechnungen/Belege** (für Steuerberater), Kassenbuch Barzahlungen.
- **Pakete** (z. B. 10 Fahrstunden im Voraus).
- **Handy-Design (Maryams Wunsch 01.11.):** schwebende Glas-Leiste unten wie Instagram, wird beim Scrollen kleiner und beim Stehenbleiben wieder groß – auf der Webseite gebaut, **in der Handy-App genauso**.
- **Push-Nachrichten** aufs Handy; **Expo-App**: Fahrlehrer-Funktionen, Kalender, Theorie, Fragen (Video erst in echter App, nicht Expo Go).
- **Webseite-Inhalte:** Fotos, Adresse/Telefon/Bürozeiten, „Über uns“, Impressum; Preise auf der Startseite; Umschreibung-Text.
- **Videos:** B neu (Blinker eingefügt) + B197 wieder komplett mit Blinker (01.11.) – auf iPhone prüfen; `bg-b78.mp4` fehlt.
- **Scrollen flüssiger (01.11., gemessen):** Wellen-Linien raus (Hauptursache), Puls-Punkt, Gold-Straße und Karten-Hover ohne Neuzeichnen, keine Misch-Modi. Messung mit 4× gebremster CPU: ruckelnde Bilder beim Scrollen 242 → 5. Wasser-Ringe nur unter der Maus auf freier Fläche (nicht Handy, nicht beim Scrollen). Auf iPhone + Laptop prüfen.
- Fachbegriffe-Übersetzungen von Muttersprachlern prüfen lassen.

## 6. Recht & Sicherheit (Details TODO-SICHERHEIT.md)
- **Vorfall 31.10.:** Anthropic-Schlüssel „beyourself-server“ missbraucht (30,5 Mio. Tokens, >10 Modelle, 94,71 $; Karte 31.10. 6× belastet, 108,45 $).
  Anthropic hat die Organisation gesperrt. Schlüssel gelöscht, Root-Passwort geändert (01.11.). Server geprüft: nur Maryams Logins,
  keine fremden Zugangsschlüssel, keine fremden Programme – aber 13.509 Passwort-Fehlversuche von Bots → **erledigt 01.11.: SSH nur noch mit Schlüssel (MacBook „NWD-mac-2024“), Passwort-Login aus, fail2ban aktiv.** Notfall-Zugang: IONOS-Konsole.
  Wahrscheinlicher Abfluss: Notiz/Zwischenablage/Browser-Erweiterung (AdBlock mit Vollzugriff) – Notiz löschen, Erweiterung entfernen.
  Offen: „Überprüfung beantragen“ bei Anthropic, danach neuer Schlüssel (nur direkt in .env), Ausgabenlimit 30 $.
- **Anwalt:** Buchungsbedingungen (Ausfall 70/75 %, „Guthaben statt Geld zurück“, Attest-Klausel wird so nicht halten,
  Muster-Ausbildungsvertrag des Fahrlehrerverbands nutzen), Widerrufsbelehrung, Datenschutzerklärung
  (Stripe, PayPal, Video/Aufnahme, Fragen-Prüfung durch Claude), Impressum.
- **Steuerberater:** TÜV-Gebühren als durchlaufender Posten, Umsatzsteuer, Belege.
- **Sicherheit offen:** ~~Root-Passwort ändern~~ ✔, ~~SSH-Schlüssel statt Passwort~~ ✔ (01.11.), 2FA (GitHub, Azure, Anthropic, IONOS, Stripe, PayPal),
  Anthropic-Schlüssel aus dem Chat löschen/neu + Ausgabenlimit, Azure-Schlüssel neu generieren, Backup außerhalb des Servers,
  `PAYMENTS_TEST_MODE=0` vor echtem Start.

## 7. Vorschlag für morgen (Reihenfolge)
1. Update einspielen (Abschnitt 1) und gemeinsam auf Handy + Laptop durchklicken (Abschnitt 2, Liste abhaken).
2. Wochenvorlage eintragen, eine Test-Fahrt buchen/absagen, eine Theoriestunde mit Beamer testen.
3. Entscheidung Video (Weg A/B) → dann bauen.
4. Danach Schritt 4 (Prüfungsphase) und Rollen & Rechte.
