# beyourself – Handy-App (Expo)

Schüler-App: Login · Mein Konto · Live-Untertitel in der eigenen Sprache · Vorlesen ·
Schriftgröße · Arabisch/Farsi von rechts nach links · Nachlesen vergangener Stunden.
Spricht mit https://fahrschule-beyourself.de (Token-Login, gleiche Konten wie die Webseite).

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
- API: `/api/app/login`, `/api/app/me`, `/api/app/lessons/[id]`, `/api/live/[id]/stream` (SSE),
  `/api/app/tts` (Vorlesen, MP3 über den Server – Azure-Schlüssel bleibt auf dem Server)
- Prüfen: `npx tsc --noEmit` · `npx expo export --platform ios`
