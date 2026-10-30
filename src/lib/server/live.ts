import "server-only";
import { createSpeechTokenCache, type SpeechToken } from "../azure-speech-token";
import { LiveHub } from "../live-hub";
import { AzureTranslator } from "../translation/azure-translator";
import { MockTranslator } from "../translation/mock";
import type { TranslationProvider } from "../translation/types";
import { db } from "./db";
import { lastSeq, saveSegment } from "./repo";

/**
 * Prozessweite Einzelinstanzen. Über globalThis, damit Next.js im
 * Entwicklungsmodus (Hot Reload) und verschiedene Route-Bundles dieselbe
 * Instanz teilen. Voraussetzung: die App läuft als EIN Node-Prozess
 * (so ist es im Docker-Setup).
 */
const g = globalThis as unknown as {
  __byHub?: LiveHub;
  __byTranslator?: TranslationProvider;
  __bySpeechToken?: () => Promise<SpeechToken>;
};

export function translator(): TranslationProvider {
  if (!g.__byTranslator) {
    if (process.env.TRANSLATION_PROVIDER === "azure") {
      g.__byTranslator = new AzureTranslator({
        key: process.env.AZURE_TRANSLATOR_KEY || "",
        region: process.env.AZURE_TRANSLATOR_REGION || "",
        endpoint: process.env.AZURE_TRANSLATOR_ENDPOINT || undefined,
      });
    } else {
      g.__byTranslator = new MockTranslator();
    }
  }
  return g.__byTranslator;
}

export function hub(): LiveHub {
  if (!g.__byHub) {
    g.__byHub = new LiveHub({
      translator: translator(),
      persist: (segment) => saveSegment(db(), segment),
      initialSeq: (lessonId) => lastSeq(db(), lessonId),
    });
  }
  return g.__byHub;
}

export function speechConfigured(): boolean {
  return Boolean(process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION);
}

export function speechToken(): Promise<SpeechToken> {
  if (!speechConfigured()) return Promise.reject(new Error("Azure Speech ist nicht eingerichtet"));
  if (!g.__bySpeechToken) {
    g.__bySpeechToken = createSpeechTokenCache({
      key: process.env.AZURE_SPEECH_KEY!,
      region: process.env.AZURE_SPEECH_REGION!,
    });
  }
  return g.__bySpeechToken();
}
