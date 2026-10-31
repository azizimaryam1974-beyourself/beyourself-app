import type { TargetLanguageCode } from "./languages";
import type { TranslationProvider, Translations } from "./translation/types";

/**
 * Verteilt die erkannten deutschen Sätze einer Theoriestunde an alle
 * verbundenen Zuhörer, jeweils in ihrer gebuchten Sprache.
 *
 * Kostenregel: Pro Satz wird nur in die Sprachen übersetzt, die gerade
 * mindestens ein verbundener Zuhörer gebucht hat.
 */

export interface CaptionEvent {
  sessionId: string;
  seq: number;
  /** deutscher Originalsatz */
  original: string;
  /** Übersetzung in der Sprache des Empfängers; fehlt bei Fehler */
  text: string | null;
  language: TargetLanguageCode | null;
  at: string;
  error?: string;
}

export interface StatusEvent {
  sessionId: string;
  status: "live" | "ended";
}

export interface Listener {
  id: string;
  userId: string;
  /** null = hört nur das deutsche Original (z. B. Verwaltung) */
  language: TargetLanguageCode | null;
  send(event: { type: "caption"; data: CaptionEvent } | { type: "status"; data: StatusEvent }): void;
}

export interface StoredSegment {
  sessionId: string;
  seq: number;
  original: string;
  translations: Translations;
  at: string;
}

export interface LiveHubOptions {
  translator: TranslationProvider;
  /** Speichert Sätze für das spätere Nachlesen (optional). */
  persist?: (segment: StoredSegment) => Promise<void> | void;
  /** Letzte gespeicherte Satznummer, damit nach einem Neustart nichts überschrieben wird. */
  initialSeq?: (sessionId: string) => number;
  /** Status nach einem Neustart aus der Datenbank übernehmen. */
  initialLive?: (sessionId: string) => boolean;
  now?: () => Date;
}

interface SessionState {
  listeners: Map<string, Listener>;
  seq: number;
  live: boolean;
  /** Sätze werden der Reihe nach verarbeitet, damit die Reihenfolge stimmt. */
  queue: Promise<void>;
  /** Letzte Sätze als Kontext für die Übersetzung. */
  recent: string[];
}

export class LiveHub {
  private sessions = new Map<string, SessionState>();
  constructor(private readonly opts: LiveHubOptions) {}

  private state(sessionId: string): SessionState {
    let s = this.sessions.get(sessionId);
    if (!s) {
      s = { listeners: new Map(), seq: this.opts.initialSeq?.(sessionId) ?? 0, live: this.opts.initialLive?.(sessionId) ?? false, queue: Promise.resolve(), recent: [] };
      this.sessions.set(sessionId, s);
    }
    return s;
  }

  isLive(sessionId: string): boolean {
    return this.state(sessionId).live;
  }

  subscribe(sessionId: string, listener: Listener): () => void {
    const s = this.state(sessionId);
    s.listeners.set(listener.id, listener);
    listener.send({ type: "status", data: { sessionId, status: s.live ? "live" : "ended" } });
    return () => {
      s.listeners.delete(listener.id);
    };
  }

  listenerCount(sessionId: string): number {
    return this.sessions.get(sessionId)?.listeners.size ?? 0;
  }

  /** Sprachen, die aktuell benötigt werden. */
  activeLanguages(sessionId: string): TargetLanguageCode[] {
    const s = this.sessions.get(sessionId);
    if (!s) return [];
    const set = new Set<TargetLanguageCode>();
    for (const l of s.listeners.values()) if (l.language) set.add(l.language);
    return [...set];
  }

  setLive(sessionId: string, live: boolean): void {
    const s = this.state(sessionId);
    s.live = live;
    for (const l of s.listeners.values()) {
      l.send({ type: "status", data: { sessionId, status: live ? "live" : "ended" } });
    }
  }

  /** Neuer deutscher Satz aus der Spracherkennung. */
  publish(sessionId: string, original: string): Promise<void> {
    const text = original.trim();
    const s = this.state(sessionId);
    if (!text) return s.queue;
    const run = async () => {
      const seq = ++s.seq;
      const at = (this.opts.now?.() ?? new Date()).toISOString();
      const languages = this.activeLanguages(sessionId);
      let translations: Translations = {};
      let error: string | undefined;
      if (languages.length) {
        try {
          translations = await this.opts.translator.translate(text, languages, { context: [...s.recent] });
        } catch (e) {
          error = "Übersetzung vorübergehend nicht verfügbar";
          console.error("[live-hub] translate failed", e);
        }
      }
      s.recent = [...s.recent, text].slice(-3);
      for (const l of s.listeners.values()) {
        const translated = l.language ? translations[l.language] ?? null : text;
        l.send({
          type: "caption",
          data: {
            sessionId,
            seq,
            original: text,
            text: translated,
            language: l.language,
            at,
            ...(l.language && translated === null ? { error: error ?? "Keine Übersetzung" } : {}),
          },
        });
      }
      try {
        await this.opts.persist?.({ sessionId, seq, original: text, translations, at });
      } catch (e) {
        console.error("[live-hub] persist failed", e);
      }
    };
    s.queue = s.queue.then(run, run);
    return s.queue;
  }
}
