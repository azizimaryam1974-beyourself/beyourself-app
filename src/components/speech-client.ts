"use client";

/** Holt (und cacht) ein kurzlebiges Azure-Speech-Token vom eigenen Server. */
let cached: { token: string; region: string; expiresAt: number } | null = null;

export async function getSpeechToken(force = false) {
  if (!force && cached && cached.expiresAt - Date.now() > 30_000) return cached;
  const res = await fetch("/api/speech-token", { cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Fehler ${res.status}`);
  cached = data;
  return cached!;
}

export function loadSpeechSdk() {
  return import("microsoft-cognitiveservices-speech-sdk");
}
