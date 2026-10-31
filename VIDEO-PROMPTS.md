# Video-Prompts für die Startseite (KI-Video-Generator)

Für Runway (Gen-4), Google Veo, OpenAI Sora oder Kling. Prompts auf **Englisch** –
damit arbeiten die Generatoren am zuverlässigsten.

## So entstehen zusammenpassende Clips

Damit alle Clips dieselbe Kreuzung zeigen, **zuerst ein Standbild** erzeugen und
dann jeden Clip **aus diesem Bild** erzeugen („Image to Video“ / „Start-Frame“).

1. **Standbild** (Prompt 0) erzeugen → als `hero-poster.jpg` speichern.
2. **Loop** (Prompt 1) mit dem Standbild als **Start-Frame** (wenn möglich auch als End-Frame → nahtlose Schleife).
3. **Abbiege-Clips** (Prompt 2–4) wieder mit dem Standbild als Start-Frame.
4. **Hintergründe der Klassen-Seiten** (Prompt 5–7) sind eigene Szenen, kein Start-Frame nötig.

**Technische Einstellungen für alle Clips**
- Format **16:9**, 1920 × 1080 (wenn möglich zusätzlich 9:16 für Handys)
- 24 Bilder/Sekunde, **ohne Ton**
- Export als **MP4 (H.264)**, möglichst klein: Loop ≤ 6 MB, Abbiegen ≤ 3 MB
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

## 1 · Loop der Kreuzung → `hero-loop.mp4` (6–7 Sekunden)

Start-Frame: Standbild. Wenn möglich End-Frame = Standbild (nahtlose Schleife).

```
Locked-off static camera, no camera movement. Calm evening at a wet New York intersection.
The pedestrian signal changes from red hand to the white walking figure. The dark sedan
stays stopped at the stop line. The waiting pedestrians calmly cross the street from left
to right in front of the car at a natural, unhurried pace. Soft steam rises slowly from a
manhole. Warm golden reflections shimmer gently on the wet asphalt, distant headlights
glide softly in the background. Slow, realistic, peaceful motion, cinematic lighting,
no sudden movements. The scene ends as it began, calm and still.
```

## 2 · Klasse B – Auto biegt **links** ab → `turn-b.mp4` (3–4 Sekunden)

```
The pedestrians have finished crossing. The dark sedan drives off smoothly and turns
LEFT into a quiet side street lined with brownstones and warm lantern light.
The camera follows with a slow, smooth dolly forward and a gentle pan to the left,
staying low over the wet reflective road. Warm golden light trails, calm and elegant.
Ends looking down the quiet side street.
```

## 3 · B197 Automatik – Auto biegt **rechts** ab → `turn-b197.mp4` (3–4 Sekunden)

```
The pedestrians have finished crossing. The dark sedan glides away almost silently and
turns RIGHT onto a wide modern avenue with tall illuminated glass towers.
The camera follows with a slow, smooth dolly forward and a gentle pan to the right over
the wet reflective road. Soft teal and champagne reflections, effortless and smooth.
Ends looking down the modern avenue.
```

## 4 · BE Anhänger – Auto fährt **geradeaus** → `turn-be.mp4` (3–4 Sekunden)

```
The pedestrians have finished crossing. A dark SUV towing a small closed trailer drives
STRAIGHT ahead across the intersection, away from the camera, toward an illuminated
bridge in the distance. The camera slowly pushes forward behind it, low over the wet
reflective road with warm golden streetlight reflections. Calm, steady, cinematic.
Ends with the bridge lights in the distance.
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

## 7 · Hintergrund Klassen-Seite BE → `bg-be.mp4` (6–8 Sekunden, Schleife)

```
Static camera. A riverside road leading to an illuminated suspension bridge at dusk, wet
asphalt with warm amber reflections, a car with a small trailer drives slowly along the
road. Wide, open, calm, cinematic, midnight blue sky with a hint of warm sunset. No text,
no logos.
```

---

## Abgeben

Die fertigen Dateien mit **genau diesen Namen** an Claude schicken (hier im Chat
anhängen). Claude legt sie in `public/video/`, prüft Größe und Format und bringt sie
auf die Webseite. Fehlt ein Clip, läuft dort automatisch die Ersatz-Animation.
