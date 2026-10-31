"use client";

import { getSpeechToken } from "./speech-client";

/**
 * Vorlesen über die Azure-TTS-REST-Schnittstelle + EIN festes <audio>-Element.
 *
 * Warum nicht das Speech-SDK? Dessen Lautsprecher-Ausgabe nutzt MediaSource/
 * Web Audio – auf dem iPhone (Safari) blockiert oder im Lautlos-Modus stumm.
 * Ein <audio>-Element, das einmal beim Antippen "entsperrt" wurde, darf danach
 * auf allen Handys weitere Sätze abspielen.
 */
const SILENT_MP3 = "data:audio/mpeg;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjYwLjE2LjEwMAAAAAAAAAAAAAAA//OEwAAAAAAAAAAAAEluZm8AAAAPAAAACQAABCAARUVFRUVFRUVFRUVdXV1dXV1dXV1dXXR0dHR0dHR0dHR0i4uLi4uLi4uLi4uioqKioqKioqKiorq6urq6urq6urq60dHR0dHR0dHR0dHo6Ojo6Ojo6Ojo6P//////////////AAAAAExhdmM2MC4zMQAAAAAAAAAAAAAAACQD8AAAAAAAAAQgDeb0IwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//NExAAAAANIAAAAAExBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTMu//NExFMAAANIAAAAADEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTMu//NExKYAAANIAAAAADEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTMu//NExKwAAANIAAAAADEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTMu//NExKwAAANIAAAAADEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTMu//NExKwAAANIAAAAADEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTMu//NExKwAAANIAAAAADEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//NExKwAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//NExKwAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV";
const MAX_QUEUE = 3; // Spricht die Lehrkraft schneller als vorgelesen wird: alte Sätze überspringen

export function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);
}

export function buildSsml(text: string, voice: string): string {
  const lang = voice.split("-").slice(0, 2).join("-");
  return `<speak version="1.0" xml:lang="${lang}"><voice name="${voice}">${escapeXml(text)}</voice></speak>`;
}

export class Speaker {
  private audio: HTMLAudioElement | null = null;
  private queue: string[] = [];
  private playing = false;
  onError: (msg: string) => void = () => {};

  constructor(private voice: string) {}

  /** MUSS direkt im Klick-/Tipp-Ereignis aufgerufen werden. */
  async unlock(): Promise<void> {
    if (!this.audio) {
      this.audio = new Audio();
      this.audio.setAttribute("playsinline", "");
      this.audio.preload = "auto";
    }
    this.audio.src = SILENT_MP3;
    await this.audio.play();
  }

  stop(): void {
    this.queue = [];
    if (this.audio) {
      this.audio.pause();
      this.audio.removeAttribute("src");
    }
    this.playing = false;
  }

  say(text: string): void {
    if (!text.trim()) return;
    this.queue.push(text);
    if (this.queue.length > MAX_QUEUE) this.queue.splice(0, this.queue.length - MAX_QUEUE);
    if (!this.playing) void this.next();
  }

  private async next(): Promise<void> {
    const text = this.queue.shift();
    if (!text || !this.audio) { this.playing = false; return; }
    this.playing = true;
    let url: string | null = null;
    try {
      const { token, region } = await getSpeechToken();
      const res = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/ssml+xml",
          "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
        },
        body: buildSsml(text, this.voice),
      });
      if (!res.ok) throw new Error(`Vorlese-Dienst antwortet mit Fehler ${res.status}`);
      url = URL.createObjectURL(await res.blob());
      const a = this.audio;
      await new Promise<void>((resolve, reject) => {
        const done = () => { a.onended = a.onerror = null; resolve(); };
        a.onended = done;
        a.onerror = () => { a.onended = a.onerror = null; reject(new Error("Abspielen nicht möglich")); };
        a.src = url!;
        a.play().catch(reject);
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.onError(/NotAllowed/i.test(msg) ? "Das Handy hat den Ton blockiert. Bitte „Vorlesen“ noch einmal antippen." : msg);
    } finally {
      if (url) URL.revokeObjectURL(url);
      void this.next();
    }
  }
}
