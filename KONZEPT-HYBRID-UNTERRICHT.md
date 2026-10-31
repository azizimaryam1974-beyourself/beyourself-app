# Konzept: Hybrider Theorieunterricht (Raum + zu Hause)

Stand 01.11.2026 – Idee von Maryam, ausgearbeitet von Claude. **Noch nicht gebaut.**

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
- **A – sofort nützlich, auch ohne Reform:** Termine + Anmeldung, Fragen-Funktion, Beamer-Ansicht.
- **B – Video** für Teilnehmer von zu Hause (technisch testen, Kosten prüfen).
- **C – nach Beschluss der Reform:** Anwesenheit von zu Hause anrechnen, Lernstandskontrolle, Sonderfahrten-Zahlen anpassen.

## Offene Fragen an Maryam
1. Teilnehmer zu Hause: eigene Kamera an (sichtbar, dass sie dabei sind) oder nur zuschauen?
2. Fragen nur schriftlich – oder auch „Hand heben“ und live sprechen?
3. Stunden aufzeichnen zum späteren Anschauen – ja/nein?
4. Name auf dem Beamer: voller Name oder „Vorname + Initial“?
