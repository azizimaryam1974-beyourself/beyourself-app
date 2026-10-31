# Video-Prompts für die Startseite (KI-Video-Generator)

Für Runway (Gen-4), Google Veo, OpenAI Sora oder Kling. Prompts auf **Englisch** –
damit arbeiten die Generatoren am zuverlässigsten.

## So entstehen zusammenpassende Clips

Damit alle Clips dieselbe Kreuzung zeigen, **zuerst ein Standbild** erzeugen und
dann jeden Clip **aus diesem Bild** erzeugen („Image to Video“ / „Start-Frame“).

1. **Standbild** (Prompt 0) erzeugen → als `hero-poster.jpg` speichern.
2. **Loop** (Prompt 1) mit dem Standbild als **Start-Frame** (wenn möglich auch als End-Frame → nahtlose Schleife).
3. **Abbiege-Clips** (Prompt 2–4: B links, B197 rechts, B78 auf die Kamera zu) wieder mit dem Standbild als Start-Frame.
4. **Hintergründe der Klassen-Seiten** (Prompt 5–7) sind eigene Szenen, kein Start-Frame nötig.

**Technische Einstellungen für alle Clips**
- Format **16:9**, 1920 × 1080 (wenn möglich zusätzlich 9:16 für Handys)
- 24 Bilder/Sekunde, **ohne Ton**
- Export als MP4 – Format egal (Runway liefert HEVC). Claude wandelt alles in web-taugliches H.264 um und verkleinert die Dateien.
- **Kommerzielle Nutzung** muss im Tarif des Generators erlaubt sein (meist nur in bezahlten Tarifen) – bitte prüfen.

**Für jeden Prompt zusätzlich als „Negative Prompt“ (falls es das Feld gibt):**
`text, letters, logos, brand names, readable signs, watermark, close-up faces, distorted cars, extra wheels, flicker, fast motion, shaky camera, cartoon, oversaturated`

---

## 0 · Standbild der Kreuzung → `hero-poster.jpg`

```
Cinematic photograph of a New York City street intersection at blue hour just after rain.
Wet asphalt with mirror-like reflections of warm golden streetlights, glowing shop windows
and soft amber traffic lights. Tall glass towers and classic brownstone buildings with warm
interior lights. Deep midnight-blue sky, light mist. The street is almost empty and calm.
One elegant dark sedan waits at the stop line in the center lane, facing the camera,
headlights on. A few pedestrians in long dark coats wait at the curb on the left, seen from
a distance, faces not recognizable. Pedestrian signal shows the red hand.
Shot at eye level from the middle of the street, 35mm anamorphic lens, shallow depth of
field, soft bokeh, subtle film grain. Color palette: champagne gold, warm beige, deep
midnight blue, anthracite, small touches of muted teal and copper. Serene, luxurious,
quiet mood. No text, no logos, no readable signs. 16:9.
```

## Runway-Regeln (Image to Video)

- **Start-Frame:** immer dein Kreuzungs-Bild (Original-PNG 2560 × 1440).
- **Nur die Bewegung beschreiben** – was im Bild zu sehen ist, weiß Runway schon.
- Jede Kamerabewegung mit **Tempo-Wort** (slow, smooth, steady …), sonst wird es beliebig.
- Sagen, **was still bleiben soll** – sonst bewegt sich alles Mögliche.
- Dauer **5 s**, Format **1280 × 720 (16:9)**. Pro Prompt 2–3 Varianten erzeugen, die beste nehmen.
  Claude kürzt die Clips danach auf die richtige Länge.

**Wichtig – aus Erfahrung (31.10.):**
- **Keinen Blinker in den Prompt schreiben.** KI-Generatoren verwechseln die Blinker-Seite
  (das Auto schaut zu uns – sein linker Blinker ist auf *unserer* rechten Seite) oder schalten
  die Warnblinker an. **Den Blinker macht die Webseite selbst** – vor dem Video, auf der richtigen Seite.
- **Nicht den Agent benutzen, sondern das normale Video-Werkzeug.** Der Agent schreibt Prompts
  um („left side of the frame“ → „left turn signal“) und macht es dadurch falsch.
- Richtung immer als **Bildseite** (wie du es am Bildschirm siehst), nie aus Sicht des Autos.

## 1 · Loop der Kreuzung → `hero-loop.mp4` (5 s)

```
The camera holds completely still. The pedestrian signal changes from the red hand to the
white walking figure. The pedestrians on the left walk calmly across the street in front of
the waiting sedan. The sedan stays stopped with its headlights on. Light mist drifts slowly,
reflections shimmer gently on the wet asphalt, distant lights twinkle softly.
No other motion in the scene.
```

## 2 · Klasse B – zur **linken Bildseite** → `turn-b.mp4` ✓ erledigt

Vorhandenes Video (31.10.) ab Sekunde 2,5 geschnitten – passt.

## 3 · Klasse B197 – zur **rechten Bildseite** → `turn-b197.mp4` (5 s)

```
The dark sedan drives slowly toward the camera, then turns smoothly and exits toward the
RIGHT EDGE of the frame, ending in a side view with the car moving to the right side of the
screen. The camera follows in one continuous, smooth orbit to the right around the car, as
if the camera turns the corner together with it. Golden reflections on the wet asphalt glide
with the motion. The headlights stay steadily on; all other car lights stay off.
The pedestrians stay still on the sidewalk.
```

## 4 · Klasse B78 – kommt **auf die Kamera zu** → `turn-b78.mp4` (5 s)

```
The dark sedan accelerates steadily straight toward the camera along the center lane,
growing larger in the frame with a strong 3D sense of depth. The camera holds low and steady
at road level with a slow push-in. At the end the front of the car fills the frame and glides
past just beside the lens, its headlights blooming into a warm golden lens flare. Reflections
on the wet asphalt stream toward the camera. The headlights stay steadily on; all other car
lights stay off. The pedestrians stay still.
```

## 5 · Hintergrund Klassen-Seite B → `bg-b.mp4` (6–8 Sekunden, Schleife)

```
Static camera. A quiet New York side street with brownstones in the evening after light
rain. Warm lantern light, wet sidewalk reflections, leaves on the ground, a car passes
slowly in the distance with warm headlights. Peaceful, intimate, cinematic, shallow depth
of field, champagne and midnight-blue tones. No text, no logos.
```

## 6 · Hintergrund Klassen-Seite B197 → `bg-b197.mp4` (6–8 Sekunden, Schleife)

```
Static camera. A wide modern avenue between illuminated glass towers at night, wet road
reflecting soft teal and champagne light, a few cars glide by smoothly leaving gentle
light trails. Clean, modern, calm, cinematic. No text, no logos.
```

## 7 · Hintergrund Klassen-Seite B78 → `bg-b78.mp4` (5–8 s, Schleife)

Text to Video (kein Start-Frame):

```
Static camera at road level. A long, straight, wet avenue at night with warm streetlights
converging into the distance. An elegant dark car glides slowly toward the camera from far
away with soft headlights. Light mist drifts, golden reflections shimmer on the asphalt.
Calm, serene, cinematic, champagne gold and midnight blue tones. No text, no logos.
```

---

## Abgeben

Die fertigen Dateien mit **genau diesen Namen** an Claude schicken (hier im Chat
anhängen). Claude legt sie in `public/video/`, prüft Größe und Format und bringt sie
auf die Webseite. Fehlt ein Clip, läuft dort automatisch die Ersatz-Animation.
