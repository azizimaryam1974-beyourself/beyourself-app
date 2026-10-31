# Fahrplan – Fahrschule Be Yourself

Stand: 31.10.2026, 13:20 · Ziel für heute: **neue Webseite sichtbar** + **App in Expo auf dem Handy**.
Sicherheit & Datenschutz: siehe [TODO-SICHERHEIT.md](TODO-SICHERHEIT.md) (verbindlich vor dem echten Start).

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
       ✓ hero-poster.jpg, bg-b.mp4, bg-b197.mp4 (31.10.) · offen: hero-loop, turn-b/-b197/-b78, bg-b78
3c. [ ] Echte Fotos, Telefon, Adresse, Bürozeiten
4. [x] App-Bereiche (Konto, Live, Unterricht, Verwaltung) im neuen Design
5. [ ] Test auf Handy + Laptop, dann Update auf den Server

## Baustein 2 – Handy-App mit Expo (heute)
1. [ ] Server: Login-Schnittstelle für die App (Token statt Cookie), Live-Stream mit Token
2. [ ] Expo-App für **iPhone** (Ordner `mobile/`): Login · Mein Konto/Sprachpaket · Live-Untertitel · Vorlesen ·
       Schrift größer/kleiner · Arabisch/Farsi von rechts nach links
3. [ ] Gleiches Design wie die Webseite
4. [ ] Auf Maryams Handy in **Expo Go** öffnen (QR-Code)
5. [ ] Später: echte App im App Store / Google Play (EAS Build, Apple/Google-Konten nötig)

## Baustein 3 – Recht & Inhalte (braucht Maryams Angaben)
- [ ] Impressum (Anschrift, Telefon, Behörde Fahrschulerlaubnis, USt-IdNr. falls vorhanden)
- [ ] Datenschutzerklärung + Sprachpaket-Bedingungen + Widerrufsbelehrung → prüfen lassen
- [ ] Texte, Preise, Fotos der Fahrschule

## Baustein 4 – Danach
- [ ] E-Mails über info@fahrschule-beyourself.de (Passwort-Link, Buchungsbestätigung)
- [ ] Theorie-Termine/Kalender, Erinnerungen
- [ ] Rest der Sicherheitsliste (SSH-Schlüssel, Sicherung außerhalb des Servers, 2FA)
