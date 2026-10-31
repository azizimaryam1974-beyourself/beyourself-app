# To-do: Sicherheit & Datenschutz (vor dem Livegang)

Stand: 31.10.2026 · Abhaken mit `[x]` · Diese Liste ist verbindlich: Die App geht
erst online, wenn alle Punkte unter **A** erledigt sind.

**Anthropic API-Schlüssel:** Der erste Schlüssel stand im Chat → löschen und neu erstellen.
Der neue Schlüssel läuft ggf. ab (Console zeigt das Datum) → rechtzeitig erneuern.

## A. Muss vor dem Livegang erledigt sein

### Recht & Datenschutz (Fachperson/Anwalt prüfen lassen)
- [ ] **Datenschutzerklärung prüfen lassen** (`/datenschutz`). Besonders der Absatz zu
      **Anthropic (USA)**: Übertragen wird nur der Text der Lehrkraft, keine Schülerdaten.
      Rechtsgrundlage für die Übermittlung in die USA klären (EU-US Data Privacy
      Framework bzw. EU-Standardvertragsklauseln).
- [ ] **Auftragsverarbeitung (AVV/DPA)** mit allen Dienstleistern abschließen bzw. ablegen:
  - [ ] Anthropic (Claude API) – Data Processing Addendum
  - [ ] Microsoft (Azure Speech + Translator) – Data Protection Addendum
  - [ ] IONOS (Server/Domain) – AVV im IONOS-Kundenkonto abschließen
- [ ] **Verzeichnis von Verarbeitungstätigkeiten** (Art. 30 DSGVO) anlegen.
- [ ] **Impressum** mit echten Angaben füllen (`/impressum`).
- [ ] **Sprachpaket-Bedingungen + Widerrufsbelehrung + Muster-Widerrufsformular** (`/sprachpaket`).
- [ ] **Löschfrist bestätigen**: voreingestellt 180 Tage nach der Stunde (auch so in der Datenschutzerklärung).
- [ ] Aufbewahrung der Paketbuchungen: Maryam sagt **3 Jahre** (31.10.2026).
      Vom Steuerberater bestätigen lassen – Rechnungen/Buchungsbelege haben steuerlich
      meist **8 Jahre** Aufbewahrungspflicht. Danach automatisches Löschen einbauen.
- [ ] Hinweis an Schüler: Übersetzung ist maschinell, maßgeblich ist der deutsche Unterricht
      (steht in den Bedingungen – bei Anmeldung sichtbar machen).
- [ ] Weitere Lehrkräfte (falls später): über Verarbeitung ihrer Stimme informieren.

### Schlüssel & Konten
- [ ] Alle Schlüssel (Azure, Anthropic) **nur** in der `.env` auf dem Server –
      nie im Chat, in E-Mails oder auf GitHub (Repository ist **öffentlich**!).
- [ ] GitHub: **Secret Scanning + Push Protection** aktivieren
      (Repository → Settings → Advanced Security).
- [ ] Anthropic Console: **Ausgabenlimit** setzen (Settings → Limits).
- [ ] Azure: vor dem Livegang die Schlüssel einmal **neu generieren** (Key 1 regenerieren),
      da sie beim Einrichten im Browser angezeigt wurden.
- [ ] Zwei-Faktor-Anmeldung (2FA) für GitHub, Azure/Microsoft, Anthropic und IONOS.

### Server (IONOS VPS)
- [x] Firewall nur 22/80/443 (ufw) – 31.10.2026
- [ ] SSH nur mit Schlüssel, Passwort-Login aus.
- [x] Automatische Sicherheitsupdates (`unattended-upgrades`) – 31.10.2026
- [ ] Tägliches Backup (`deploy/backup.sh`, per install.sh) **und eine Wiederherstellung testen**.
- [ ] Sicherung zusätzlich außerhalb des Servers ablegen (z. B. IONOS Object Storage).
- [x] HTTPS aktiv, HSTS gesetzt, https://fahrschule-beyourself.de erreichbar – 31.10.2026

### App (Programmierung – erledigt Claude)
- [x] Schutz gegen Passwort-Raten beim Login (5 Fehlversuche/15 Min pro E-Mail, 20 pro IP) – 31.10.2026
- [x] „Passwort vergessen“: Einmal-Link (24 h) aus der Verwaltung – 31.10.2026
      (später optional: Link automatisch per E-Mail, braucht IONOS-Postfach/SMTP)
- [x] Automatisches Löschen alter Unterrichtsprotokolle (`LESSON_RETENTION_DAYS`, Standard 180) – 31.10.2026
- [x] Verwaltung → „Mehr …“: Datenauskunft (JSON) und Konto löschen (Buchung bleibt anonym) – 31.10.2026

## B. Kurz nach dem Start
- [ ] Fachbegriff-Übersetzungen von Muttersprachlern gegenlesen lassen
      (`src/lib/glossary.ts`; geprüft: „rechts vor links“ Farsi).
- [ ] Azure: Budget-Warnung anlegen, sobald auf bezahlten Tarif (S0/S1) gewechselt wird.
- [ ] Nach den ersten Stunden: Kosten in Anthropic Console und Azure prüfen.

## Erledigt
- [x] Server 82.165.0.233 (IONOS VPS 1-2-60), DNS @/www → Server, App online – 31.10.2026
- [ ] ⚠ Erstes App-Passwort der Lehrkraft war im Terminal sichtbar → neu setzen (Befehl in install.sh-Ausgabe)
- [x] Azure-Abonnement, Speech + Translator (F0, Germany West Central) – 31.10.2026
- [x] Code auf GitHub, `.env` und Datenbank ausgeschlossen – 31.10.2026
- [x] Claude-Übersetzung mit Azure als Reserve – 31.10.2026
- [x] Anthropic-Guthaben aufgeladen (20 €) – 31.10.2026
