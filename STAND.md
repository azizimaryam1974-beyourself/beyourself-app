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
→ Danach prüfen: Die alte LIVE-Stunde vom 31.10. muss innerhalb einer Minute auf „Beendet“ springen.

## 2. Gebaut, aber NOCH NICHT ECHT GETESTET
(Automatische Tests laufen: 80/80. Durchgespielt im Test-Browser mit Testkonten. Aber nicht mit echten Geräten/Diensten:)

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
6. **Stripe-Konto + PayPal-Geschäftskonto** anlegen (gemeinsam, Schritt für Schritt).
7. **IONOS-Mailpasswort** in `.env` eintragen (gemeinsam).
8. **Echte Arbeitszeiten** (Wochenvorlage) eintragen.
9. Texte „Was ist enthalten“ bei Preise & Leistungen durchlesen.

## 5. Noch NICHT gebaut
- **Video + Aufnahme** (Konzept fertig, siehe KONZEPT-HYBRID-UNTERRICHT.md) inkl. „Wort geben“ mit Mikrofon.
- **Schritt 4 Prüfungsphase:** Grundbetrag bei Anmeldung bezahlen, Einladung zur Prüfung durch die Fahrschule (Schüler bestätigt,
  Nichterscheinen = Geld weg), Warmstunde + Prüfungsgebühr + TÜV-Gebühren zahlen, getrennt auf Rechnung.
- **Rollen & Rechte:** weitere Admins/Fahrlehrer einladen, jedes Recht einzeln (z. B. Termine ja, Zahlungen nein); je Fahrlehrer eigener Kalender.
- **Mehrere Fahrschulen** (technisch vorbereiten, erst nach einigen Monaten Betrieb freischalten).
- **Sonderfahrten-Zahlen einstellbar** (Reform 21/7404 schafft feste 5/4/3 evtl. ab).
- **Rechnungen/Belege** (für Steuerberater), Kassenbuch Barzahlungen.
- **Pakete** (z. B. 10 Fahrstunden im Voraus).
- **Push-Nachrichten** aufs Handy; **Expo-App**: Fahrlehrer-Funktionen, Kalender, Theorie, Fragen (Video erst in echter App, nicht Expo Go).
- **Webseite-Inhalte:** Fotos, Adresse/Telefon/Bürozeiten, „Über uns“, Impressum; Preise auf der Startseite; Umschreibung-Text.
- **Videos:** neuer Runway-Clip Klasse B (Linksabbiegen vom Startbild, gleiches Auto), `bg-b78.mp4` fehlt.
- Fachbegriffe-Übersetzungen von Muttersprachlern prüfen lassen.

## 6. Recht & Sicherheit (Details TODO-SICHERHEIT.md)
- **Anwalt:** Buchungsbedingungen (Ausfall 70/75 %, „Guthaben statt Geld zurück“, Attest-Klausel wird so nicht halten,
  Muster-Ausbildungsvertrag des Fahrlehrerverbands nutzen), Widerrufsbelehrung, Datenschutzerklärung
  (Stripe, PayPal, Video/Aufnahme, Fragen-Prüfung durch Claude), Impressum.
- **Steuerberater:** TÜV-Gebühren als durchlaufender Posten, Umsatzsteuer, Belege.
- **Sicherheit offen:** Root-Passwort ändern, SSH-Schlüssel statt Passwort, 2FA (GitHub, Azure, Anthropic, IONOS, Stripe, PayPal),
  Anthropic-Schlüssel aus dem Chat löschen/neu + Ausgabenlimit, Azure-Schlüssel neu generieren, Backup außerhalb des Servers,
  `PAYMENTS_TEST_MODE=0` vor echtem Start.

## 7. Vorschlag für morgen (Reihenfolge)
1. Update einspielen (Abschnitt 1) und gemeinsam auf Handy + Laptop durchklicken (Abschnitt 2, Liste abhaken).
2. Wochenvorlage eintragen, eine Test-Fahrt buchen/absagen, eine Theoriestunde mit Beamer testen.
3. Entscheidung Video (Weg A/B) → dann bauen.
4. Danach Schritt 4 (Prüfungsphase) und Rollen & Rechte.
