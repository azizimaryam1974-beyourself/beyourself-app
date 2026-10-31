# Fahrplan – Fahrschule Be Yourself

Stand: 31.10.2026, 13:20 · Ziel für heute: **neue Webseite sichtbar** + **App in Expo auf dem Handy**.
Sicherheit & Datenschutz: siehe [TODO-SICHERHEIT.md](TODO-SICHERHEIT.md) (verbindlich vor dem echten Start).

## ⚠️ Angefangen, aber nicht fertig (Merkliste, Stand 31.10.2026 21 Uhr)
**Auf dem Server fehlt noch:** die letzten 2 Updates (Kreuzung-Reparatur + Online-Buchung) →
`cd /opt/beyourself && git pull && docker compose up -d --build`

Webseite
- [ ] Neuer Runway-Clip Klasse B (Linksabbiegen vom Startbild aus, gleiches Auto) – jetziger Clip ist ein Notbehelf
- [ ] Hintergrund-Video Klasse B78 (`bg-b78.mp4`) fehlt
- [ ] Echte Inhalte: Fotos, Adresse, Telefon, Bürozeiten, „Über uns“, Impressum
- [ ] Preise auf der Webseite (jetzt bekannt, siehe ARBEITSWEISE.md) + Klasse Umschreibung bestätigt → Text anpassen

Online-Buchung (gebaut, aber noch nicht im Einsatz)
- [ ] Wird umgebaut nach ARBEITSWEISE.md (Ausbildungsablauf, 90-Min-Blöcke, Arbeitszeiten, Rechte)
- [ ] Stripe-Konto + PayPal-Geschäftskonto (Maryam), Schlüssel in .env
- [ ] IONOS-Mailpasswort in .env (E-Mails an Schüler)
- [ ] Buchungsbedingungen, Widerrufsbelehrung, Datenschutz (Stripe/PayPal) rechtlich prüfen lassen
- [ ] Pakete (z. B. 10 Fahrstunden im Voraus)

Handy-App (Expo)
- [ ] Noch nie auf Maryams iPhone in Expo Go geöffnet
- [ ] Bisher nur Schüler-Funktionen; Kalender/Anfragen/Ausbildungsstand für Fahrlehrer fehlen
- [ ] Push-Nachrichten fehlen (braucht EAS-Projekt)

Live-Übersetzung
- [ ] Fachbegriffe von Muttersprachlern gegenlesen (nur Farsi „rechts vor links“ geprüft)
- [ ] Theorie-Termine/Kalender

Sicherheit (Details: TODO-SICHERHEIT.md)
- [ ] Root-Passwort ändern, SSH-Schlüssel statt Passwort, 2FA überall
- [ ] Anthropic-Schlüssel, der im Chat stand, löschen/neu (bestätigen!), Ausgabenlimit
- [ ] Azure-Schlüssel neu generieren, Backup außerhalb des Servers

## Bereits fertig (Stand heute)
- [x] Web-App online: https://fahrschule-beyourself.de (IONOS VPS, HTTPS)
- [x] Anmeldung mit Sprachpaket 30 €, Verwaltung (bezahlt/storniert, Passwort-Link, DSGVO)
- [x] Live-Übersetzung: Azure Spracherkennung → Claude (Azure als Reserve) → 6 Sprachen + Farsi zuschaltbar
- [x] Vorlesen auf dem Handy (auch iPhone)
- [x] Code auf GitHub, tägliche Sicherung auf dem Server

## Baustein 1 – Neue Webseite (heute)
1. [x] Design-Vorgaben von Maryam (Prompt) übernehmen
2. [x] Design-Entwurf gezeigt (Glassmorphism × Dark Luxury)
3. [ ] Öffentliche Seiten bauen (modern, mobil zuerst, barrierearm):
       Startseite · Führerscheinklassen & Preise · Sprachpaket/Live-Übersetzung ·
       Über uns · Kontakt (Karte, Telefon, WhatsApp, info@) · Anmeldung
3a. [x] Stadt-Szene: Straßenschilder als Navigation (Klasse B ←, Klasse B197 →, Klasse B78 ↑) – kein BE/Anhänger, Abbiegen → Klassen-Seite
3b. [ ] **Videos von Maryam** per KI-Generator (Prompts: VIDEO-PROMPTS.md) → in public/video/
       ✓ hero-poster.jpg, bg-b.mp4, bg-b197.mp4 (31.10.) · turn-b, turn-b197, turn-b78, hero-loop (31.10.) · offen: bg-b78
3c. [ ] Echte Fotos, Telefon, Adresse, Bürozeiten
4. [x] App-Bereiche (Konto, Live, Unterricht, Verwaltung) im neuen Design
5. [ ] Test auf Handy + Laptop, dann Update auf den Server

## Baustein 2 – Handy-App mit Expo (heute)
1. [x] Server: Token-Login, /api/app/me, /lessons, /tts, Live-Stream mit Token – 31.10.2026
2. [x] Expo-App für **iPhone** (Ordner `mobile/`, SDK 58): Login · Mein Konto/Sprachpaket · Live-Untertitel · Vorlesen ·
       Schrift größer/kleiner · Arabisch/Farsi von rechts nach links
3. [x] Gleiches Design wie die Webseite
4. [ ] Auf Maryams Handy in **Expo Go** öffnen (QR-Code)
5. [ ] Später: echte App im App Store / Google Play (EAS Build, Apple/Google-Konten nötig)

## Baustein 3 – Recht & Inhalte (braucht Maryams Angaben)
- [ ] Impressum (Anschrift, Telefon, Behörde Fahrschulerlaubnis, USt-IdNr. falls vorhanden)
- [ ] Datenschutzerklärung + Sprachpaket-Bedingungen + Widerrufsbelehrung → prüfen lassen
- [ ] Texte, Preise, Fotos der Fahrschule

## Baustein 3b – Online-Buchung & Bezahlen (31.10.)
- [x] Kalender für die Fahrschule: Termine freigeben (Serien, mehrere Stunden am Stück), Anfragen bestätigen/ablehnen
      mit Textvorlagen oder eigenem Text, Absagen mit Erstattung, „Bar/EC bezahlt“
- [x] Schüler: freie Termine anfragen → nach Bestätigung 30 Min zum Bezahlen → sonst automatisch wieder frei
- [x] Kostenlose Absage bis 24 Std vorher mit automatischer Rückzahlung; Regeln selbst einstellbar
- [x] Angebote & Preise selbst pflegen (Fahrstunden, Sonderfahrten, Grundbeträge, Sprachpaket)
- [x] Nachrichten im Konto + E-Mail (sobald SMTP eingetragen)
- [ ] Stripe-Konto + PayPal-Geschäftskonto anlegen (Maryam), Schlüssel in .env
- [ ] IONOS-Mailpasswort in .env (SMTP)
- [ ] Preise eintragen
- [ ] Buchungsbedingungen + Widerrufsbelehrung rechtlich prüfen lassen
- [ ] Kalender & Anfragen auch in der Handy-App (Expo) + Push-Nachrichten

## Baustein 4 – Danach
- [ ] E-Mails über info@fahrschule-beyourself.de (Passwort-Link, Buchungsbestätigung)
- [ ] Theorie-Termine/Kalender, Erinnerungen
- [ ] Rest der Sicherheitsliste (SSH-Schlüssel, Sicherung außerhalb des Servers, 2FA)
