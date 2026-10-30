# To-do: Sicherheit & Datenschutz (vor dem Livegang)

Stand: 31.10.2026 · Abhaken mit `[x]` · Diese Liste ist verbindlich: Die App geht
erst online, wenn alle Punkte unter **A** erledigt sind.

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
- [ ] **Löschfrist** für Unterrichtsprotokolle festlegen und in Datenschutzerklärung eintragen.
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
- [ ] SSH nur mit Schlüssel, Passwort-Login aus, Firewall nur 22/80/443.
- [ ] Automatische Sicherheitsupdates (`unattended-upgrades`).
- [ ] Tägliches Backup (`deploy/backup.sh`) einrichten **und eine Wiederherstellung testen**.
- [ ] HTTPS prüfen (Caddy holt das Zertifikat automatisch).

### App (Programmierung – erledigt Claude)
- [ ] Schutz gegen Passwort-Raten beim Login (Rate Limiting).
- [ ] „Passwort vergessen“-Funktion.
- [ ] Automatisches Löschen alter Unterrichtsprotokolle nach der festgelegten Frist.
- [ ] In der Verwaltung: Schülerdaten **exportieren** (Auskunft) und **löschen** (DSGVO-Rechte).

## B. Kurz nach dem Start
- [ ] Fachbegriff-Übersetzungen von Muttersprachlern gegenlesen lassen
      (`src/lib/glossary.ts`; geprüft: „rechts vor links“ Farsi).
- [ ] Azure: Budget-Warnung anlegen, sobald auf bezahlten Tarif (S0/S1) gewechselt wird.
- [ ] Nach den ersten Stunden: Kosten in Anthropic Console und Azure prüfen.

## Erledigt
- [x] Azure-Abonnement, Speech + Translator (F0, Germany West Central) – 31.10.2026
- [x] Code auf GitHub, `.env` und Datenbank ausgeschlossen – 31.10.2026
- [x] Claude-Übersetzung mit Azure als Reserve – 31.10.2026
- [x] Anthropic-Guthaben aufgeladen (20 €) – 31.10.2026
