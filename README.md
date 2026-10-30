# Be Yourself – Fahrschul-App mit Live-Übersetzung

Theorieunterricht auf Deutsch, Schüler lesen live in ihrer Sprache mit
(Türkisch, Englisch, Russisch, Arabisch, Spanisch; Farsi zuschaltbar).
Sprachpaket: **30 € einmalig** pro Ausbildung, wählbar bei der Anmeldung.

## Ablauf

| Wer | Seite | Was passiert |
|---|---|---|
| Schüler | `/anmelden` | Konto anlegen, Sprachpaket ja/nein, Sprache wählen. Button heißt „zahlungspflichtig buchen“. |
| Schüler | `/konto` | Paketstatus, laufende Stunde antippen, alte Stunden nachlesen, Paket nachbuchen. |
| Schüler | `/live/<id>` | Untertitel in eigener Sprache, Deutsch darunter, Schriftgröße, Vorlesen (Kopfhörer). |
| Lehrkraft | `/unterricht/<id>` | Stunde starten → Mikrofon an. Azure erkennt Deutsch, jeder Satz geht an alle Schüler. Sätze können auch getippt werden. |
| Lehrkraft | `/verwaltung` | Alle Anmeldungen, Paket „bezahlt“ / „storniert“, Sprache ändern, Paket im Büro buchen. |

Bezahlung: Das Paket ist ab Buchung freigeschaltet, Zahlung erfolgt bar/EC/Überweisung
in der Fahrschule und wird in der Verwaltung abgehakt. (Erst nach Zahlung freischalten:
eine Zeile in `src/lib/language-package.ts` → `hasTranslationAccess`.)

Kosten: Übersetzt wird pro Satz nur in die Sprachen, die gerade jemand hört.
Ohne Zuhörer mit Paket entstehen nur Kosten für die Spracherkennung.

## Lokal ausprobieren (ohne Azure)

```bash
npm install
cp .env.example .env          # TRANSLATION_PROVIDER=mock
npm run create-teacher -- maryam@fahrschule-beyourself.de "Maryam Azizi"
npm run dev                    # http://localhost:3000
npm test
```

Im Testmodus werden Übersetzungen nur markiert („[TR] …“) und Sätze werden in der
Konsole eingetippt statt gesprochen.

## 1. Azure einrichten (einmalig, ca. 15 Minuten)

1. Konto auf <https://portal.azure.com> anlegen (Firmenkonto der Fahrschule).
2. **Ressourcengruppe** `beyourself` anlegen, Region **Germany West Central**.
3. Ressource **Speech** (Azure AI Speech) anlegen – Region *Germany West Central*,
   Tarif *Free F0* zum Testen, später *Standard S0*.
   → „Schlüssel und Endpunkt“: Schlüssel 1 = `AZURE_SPEECH_KEY`.
4. Ressource **Translator** anlegen – Region *Germany West Central*, Tarif *F0* oder *S1*.
   → Schlüssel 1 = `AZURE_TRANSLATOR_KEY`.
5. In der `.env` auf dem Server `TRANSLATION_PROVIDER=azure` setzen.
6. **Budget-Warnung** anlegen (Kostenverwaltung → Budgets), z. B. 20 €/Monat.
7. Microsoft-Datenschutznachtrag (DPA) gilt automatisch für Azure-Kunden – in der
   Datenschutzerklärung erwähnen (Vorlage unter `/datenschutz`).

Die Schlüssel bleiben auf dem Server. Browser bekommen nur 10-Minuten-Tokens,
und nur Lehrkräfte und Schüler mit Paket.

## 2. Server und Domain (IONOS)

Die Live-Übersetzung braucht einen dauerhaft laufenden Node-Server
(normales IONOS-Webhosting/„Website-Baukasten“ reicht **nicht**).
Empfehlung: **IONOS VPS Linux** (kleinste Stufe genügt), Ubuntu 24.04, Rechenzentrum Deutschland.

### 2a. DNS bei IONOS

IONOS-Login → **Domains & SSL** → `fahrschule-beyourself.de` → **DNS**:

| Typ | Hostname | Wert |
|---|---|---|
| A | `@` | öffentliche IPv4 des VPS |
| A | `www` | öffentliche IPv4 des VPS |
| AAAA | `@` / `www` | IPv6 des VPS (falls vorhanden, sonst vorhandene AAAA-Einträge löschen) |

Vorhandene A/AAAA-Einträge, die auf IONOS-Parkseiten zeigen, entfernen.
MX-Einträge (E-Mail) **nicht** anfassen. Änderung braucht meist Minuten, bis zu einige Stunden.
Prüfen: `dig +short fahrschule-beyourself.de` muss die VPS-IP zeigen.

### 2b. Server vorbereiten

```bash
ssh root@<VPS-IP>
apt update && apt upgrade -y
curl -fsSL https://get.docker.com | sh
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw enable
mkdir -p /opt/beyourself && cd /opt/beyourself
# Projekt hierher kopieren (git clone oder scp des ZIPs)
cp .env.example .env && nano .env      # Azure-Schlüssel, TRANSLATION_PROVIDER=azure
docker compose up -d --build
docker compose exec app npm run create-teacher -- maryam@fahrschule-beyourself.de "Maryam Azizi"
```

Caddy holt das HTTPS-Zertifikat selbst, sobald DNS stimmt. **HTTPS ist Pflicht** –
ohne HTTPS erlauben Browser kein Mikrofon.

Updates: `git pull && docker compose up -d --build`
Sicherung: `deploy/backup.sh` per Cron täglich (legt `backups/` an, hält 30 Tage).

## Vor dem Livegang

- [ ] `/impressum`, `/datenschutz`, `/sprachpaket` mit echten Angaben füllen und rechtlich prüfen
      (Widerrufsbelehrung + Muster-Widerrufsformular für das Sprachpaket).
- [ ] Mikrofon testen: Headset oder Ansteckmikrofon am Laptop – deutlich bessere Erkennung als Laptop-Mikro.
- [ ] Fachbegriffe in `src/lib/glossary.ts` für Türkisch/Russisch/Arabisch/Spanisch von Muttersprachlern ergänzen.
- [ ] Farsi: `ENABLE_FARSI=1` in `.env`, dann `docker compose up -d`.

## Technik

Next.js 15 (App Router) · SQLite (better-sqlite3) · Azure Speech SDK im Browser der Lehrkraft ·
Azure Translator (EU-Endpunkt, Fachbegriff-Wörterbuch) · Server-Sent Events zu den Schülern ·
Azure Neural Voices zum Vorlesen. Läuft als **ein** Prozess (Live-Hub im Speicher).

```
src/lib/                 Kern: Sprachen, Paket, Glossar, Übersetzer, Live-Hub
src/lib/server/          Datenbank, Login, Zugriffsregeln, Singletons
src/app/api/live/…       publish (Lehrkraft) · stream (SSE) · stats
src/app/api/speech-token Kurzlebige Azure-Tokens
```
