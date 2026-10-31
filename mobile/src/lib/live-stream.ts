import { fetch } from 'expo/fetch';
import { API_URL } from './config';
import type { Caption } from './api';

type Handlers = {
  onCaption: (c: Caption) => void;
  onStatus: (live: boolean) => void;
  onConnection: (connected: boolean) => void;
};

/**
 * Hört den Live-Stream einer Stunde (Server-Sent Events) mit Token.
 * Verbindet sich bei Abbruch automatisch neu. Rückgabe: Funktion zum Beenden.
 */
export function listenToLesson(lessonId: string, token: string, h: Handlers): () => void {
  let stopped = false;
  let controller: AbortController | null = null;
  let retry = 1000;

  const parseBlock = (block: string) => {
    let event = 'message';
    const data: string[] = [];
    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) data.push(line.slice(5).trimStart());
    }
    if (!data.length) return;
    try {
      const json = JSON.parse(data.join('\n'));
      if (event === 'caption') h.onCaption(json as Caption);
      else if (event === 'status') h.onStatus(json.status === 'live');
    } catch {}
  };

  const run = async () => {
    while (!stopped) {
      controller = new AbortController();
      try {
        const res = await fetch(`${API_URL}/api/live/${encodeURIComponent(lessonId)}/stream`, {
          headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' },
          signal: controller.signal,
        });
        if (!res.ok || !res.body) throw new Error(String(res.status));
        h.onConnection(true);
        retry = 1000;
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';
        while (!stopped) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true }).replace(/\r/g, '');
          let i: number;
          while ((i = buf.indexOf('\n\n')) >= 0) {
            parseBlock(buf.slice(0, i));
            buf = buf.slice(i + 2);
          }
        }
      } catch {
        // Netzwerkfehler → neu verbinden
      }
      h.onConnection(false);
      if (stopped) return;
      await new Promise((r) => setTimeout(r, retry));
      retry = Math.min(retry * 2, 15000);
    }
  };
  run();

  return () => {
    stopped = true;
    controller?.abort();
  };
}
