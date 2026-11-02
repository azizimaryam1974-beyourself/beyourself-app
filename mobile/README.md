# beyourself – Handy-App (Expo) für iPhone und Android

Die App zeigt **die komplette Webseite** fahrschule-beyourself.de – für Schüler **und** Fahrschule, mit allem, was es dort gibt
(Kalender, Schüler, Chat, Finanzen, Belege, Unterlagen, Live-Unterricht …). Neue Funktionen auf der Webseite sind sofort
auch in der App, ohne neue App-Version.

Dazu, was nur eine App kann:
- **Push-Benachrichtigungen** (jede Mitteilung im Konto: Buchung, Erinnerung, Chat-Nachricht …) – Tipp darauf öffnet die passende Seite
- **Bezahlen im sicheren In-App-Browser** (Apple Pay, Google Pay, Klarna funktionieren dort), danach automatisch zurück in die App
- Kamera für Ausweis/Belege, Mikrofon für den Live-Unterricht, Wischen zurück, Ziehen zum Aktualisieren, Android-Zurück-Taste
- Eigenes App-Symbol (goldenes „b“), Startbild, Telefon/E-Mail/Karten öffnen die passenden Apps

## Auf dem iPhone ansehen (Expo Go)

Einmalig: **Node.js** auf dem Mac (https://nodejs.org, LTS) und **Expo Go** aus dem App Store.

Im Terminal **auf dem Mac** (nicht auf dem Server):

```bash
git clone https://github.com/azizimaryam1974-beyourself/beyourself-app.git
cd beyourself-app/mobile
npm install
npx expo start
```

Mit der **iPhone-Kamera den QR-Code** scannen → öffnet sich in Expo Go.
iPhone und Mac müssen im **selben WLAN** sein. Sonst: `npx expo start --tunnel`.

Später aktualisieren: `cd beyourself-app && git pull && cd mobile && npm install && npx expo start`

## Für Entwickler

- SDK 58, Expo Router (`src/app`), Pakete immer mit `npx expo install`
- Server-Adresse: `EXPO_PUBLIC_API_URL` (Standard: https://fahrschule-beyourself.de)
- Aufbau: `src/app/index.tsx` = WebView-Hülle. Kennung im User-Agent: `beyourselfApp/1.0` (der Server erkennt daran die App).
- Push: Webseite (`src/components/AppBridge.tsx`) fragt per `postMessage` nach dem Token → App liefert Expo-Push-Token →
  Webseite meldet ihn an `/api/push`. Der Server schickt jede `addNotification` zusätzlich als Push (`src/lib/server/push.ts`).
  Push braucht ein EAS-Projekt (`eas init` → `extra.eas.projectId`) und eine echte App (Development Build/TestFlight), nicht Expo Go.
- Bezahlen: Stripe-Checkout wird im `openAuthSessionAsync` geöffnet; Erfolg/Abbruch leiten auf `beyourself://zurueck?ziel=…`.
- Bekannte Grenze: Datei-Downloads (Excel-Export, ZIP) bitte am PC/Laptop.
- Prüfen: `npx tsc --noEmit` · `npx expo export --platform ios`
