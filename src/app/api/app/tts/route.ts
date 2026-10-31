import { currentUser } from "@/lib/server/auth";
import { listenerLanguage } from "@/lib/server/access";
import { speechConfigured, speechToken } from "@/lib/server/live";
import { getLanguage } from "@/lib/languages";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX = 600;

function escapeXml(s: string) {
  return s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);
}

/**
 * Vorlesen für die Handy-App: liefert MP3 in der Stimme der gebuchten Sprache.
 * Der Azure-Schlüssel bleibt auf dem Server.
 */
export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return new Response("Nicht angemeldet", { status: 401 });
  const code = listenerLanguage(user);
  if (!code) return new Response("Kein Sprachpaket", { status: 403 });
  if (!speechConfigured()) return new Response("Vorlesen nicht eingerichtet", { status: 503 });
  const text = (new URL(req.url).searchParams.get("text") ?? "").trim().slice(0, MAX);
  if (!text) return new Response("Kein Text", { status: 400 });

  const voice = getLanguage(code)!.ttsVoice;
  const lang = voice.split("-").slice(0, 2).join("-");
  const { token, region } = await speechToken();
  const res = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
      "User-Agent": "beyourself-app",
    },
    body: `<speak version="1.0" xml:lang="${lang}"><voice name="${voice}">${escapeXml(text)}</voice></speak>`,
  });
  if (!res.ok || !res.body) return new Response("Vorlese-Dienst nicht erreichbar", { status: 502 });
  return new Response(res.body, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=3600" } });
}
