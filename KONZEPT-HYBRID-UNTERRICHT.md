# Konzept: Hybrider Theorieunterricht (Raum + zu Hause)

Stand 01.11.2026 – Idee von Maryam, ausgearbeitet von Claude. **Teil A gebaut (01.11.2026)**, Video (B) folgt.

## Rechtlicher Rahmen (Stand 01.11.2026)
- **Heute:** Theorieunterricht ist Präsenzpflicht. Wer von zu Hause zuschaut, bekommt die Stunde (noch) nicht als Pflichtstunde angerechnet.
- **Reform (Gesetzentwurf BT-Drucksache 21/7404):** Präsenzpflicht soll entfallen, Fahrschulen entscheiden selbst über die Form;
  geplantes Inkrafttreten Anfang 2027. Stand: 1. Lesung 24.09.2026, Anhörung 05.10.2026, **noch nicht beschlossen**.
  Fahrlehrerverbände fordern einen verbindlichen Präsenzanteil und Lernstandskontrollen → die App sollte beides können.
- Reform sieht auch vor: **keine feste Zahl Sonderfahrten** mehr (nur noch: Überland, Autobahn, Dunkelheit müssen vorkommen).
  → Die Zahlen 5/4/3 in der App müssen einstellbar werden.

## Ziel
Eine Stunde, zwei Gruppen:
- **Im Raum:** sehen Maryam, die Tafel und den Beamer/LED-Bildschirm.
- **Zu Hause:** sehen Maryam per Video in der App/Webseite, lesen Untertitel (übersetzt), stellen Fragen.
- **Fragen** (von zu Hause und auch aus dem Raum, leise per Handy) erscheinen bei Maryam und groß auf dem Beamer:
  „Frage von Lona S.: …“ – Maryam beantwortet sie für alle.

## Bausteine
1. **Theorie-Termine mit Anmeldung** – Datum/Uhrzeit, Thema, Ort; Schüler melden sich an (im Raum / von zu Hause).
   Nur Angemeldete sehen die Stunde, die Fragen und das Video. Termin sperrt automatisch Fahrstunden-Zeiten.
2. **Fragen-Funktion** – Frage tippen (in eigener Sprache, wird für Maryam ins Deutsche übersetzt), Warteschlange bei Maryam,
   „Auf Beamer zeigen“, „Beantwortet“, „Ausblenden“.
3. **Beamer-Ansicht** – eigene Seite für den großen Bildschirm: aktuelle Frage groß, Untertitel, QR-Code zum Mitmachen.
4. **Video** – Kamera + Mikrofon von Maryam live an Angemeldete (Verzögerung ~1 Sek., WebRTC, z. B. LiveKit, EU-Server).
5. **Anwesenheit & Lernstand** – wer war wie lange dabei (Raum/zu Hause), kurze Lernstandskontrolle (3–5 Fragen) am Ende
   → Nachweis, falls Verbände/Behörde das nach der Reform verlangen.

## Reihenfolge (Vorschlag)
- ✓ **A – sofort nützlich, auch ohne Reform:** Termine + Anmeldung, Fragen-Funktion (mit Prüfung), Hand heben, Beamer-Ansicht.
- **B – Video** für Teilnehmer von zu Hause (technisch testen, Kosten prüfen).
- **C – nach Beschluss der Reform:** Anwesenheit von zu Hause anrechnen, Lernstandskontrolle, Sonderfahrten-Zahlen anpassen.

## Entscheidungen (01.11.2026)
1. **Kamera der Teilnehmer zu Hause:** soll später Pflicht sein – gebaut wird das erst, wenn die Reform beschlossen ist.
   **Jetzt:** Mikrofon an/aus.
2. **Hand heben** auf jeden Fall. **Live sprechen** ja – aber erst, wenn Maryam das Wort gibt (sonst bleibt das Mikrofon zu).
   **Schriftliche Fragen** ja, in eigener Sprache, für Maryam übersetzt.
   **Schutz vor Beleidigungen/Unsinn:** jede schriftliche Frage wird vor dem Anzeigen automatisch geprüft (alle Sprachen);
   Beleidigungen/Schimpfwörter werden ausgeblendet. Auf den Beamer kommt nur, was Maryam freigibt.
   Maryam kann einzelne Teilnehmer stummschalten oder für die Stunde sperren.
3. **Aufzeichnen:** ja – Stunden können später angeschaut werden (Aufbewahrungsdauer festlegen; Speicherplatz außerhalb des Servers).
   Wer das Wort bekommt, sieht vorher den Hinweis „wird aufgezeichnet“.
4. **Name auf dem Beamer:** „Vorname + Initial“ (z. B. Lona S.).

## Technischer Plan Video & Aufnahme (besprochen 01.11.2026)
- **Video-Server:** LiveKit (WebRTC, ~0,5–1 Sek. Verzögerung). Weg A: LiveKit Cloud (Test gratis 5.000 Teilnehmer-Min/Monat,
  danach „Ship“ 50 $/Monat inkl. 150.000 Min; US-Firma, Region fest erst im Scale-Tarif). Weg B (Empfehlung): eigener Server in
  Deutschland (~15–30 €/Monat) + Speicher für Aufnahmen (z. B. Hetzner Object Storage 6,49 €/Monat für 1 TB).
- **Rechnung:** 1 Stunde mit 15 Teilnehmern zu Hause ≈ 1.440 Teilnehmer-Minuten; 8 Stunden/Monat ≈ 11.500 Min.
- **Hardware:** Laptop (Chrome/Edge), Ansteck-Funkmikrofon mit USB-Empfänger (wichtigstes Teil), Full-HD-Webcam auf Stativ
  (nur Lehrerin + Tafel im Bild, nicht die Klasse), HDMI zum LED als 2. Bildschirm (Beamer-Ansicht), Lautsprecher, Upload ≥ 5–10 Mbit/s (Kabel).
- **Ablauf:** „Stunde starten“ mit Schalter „Video + Aufnahme“ → Laptop sendet Bild/Ton an Video-Server, Spracherkennung läuft parallel.
  Schüler zu Hause: nur Angemeldete bekommen einen persönlichen Zugangsschlüssel; Mikrofon serverseitig gesperrt.
  Hand heben → „Wort geben“ → Server erlaubt nur diesem Schüler das Mikrofon (Hinweis „wird aufgezeichnet“) → „Wort entziehen“ / Auto-Ende nach 2 Min.
- **Aufnahme:** Bild + Ton der Lehrerin (+ Ton der Sprechenden), MP4 (90 Min ≈ 1–1,5 GB) im Speicher in Deutschland; Abspielen über
  kurzlebige Links; Untertitel daneben; automatisches Löschen nach Frist.
- **App:** Video im Handy-Browser sofort; in der Expo-App erst mit echter App-Version (EAS-Build), nicht in Expo Go.
- **Reihenfolge:** Hardware + Speedtest → Video + Wort geben → Aufnahme → (nach Reform) Schüler-Kameras + Anwesenheit → Video in der App.
