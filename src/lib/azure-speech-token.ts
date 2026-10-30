/**
 * Kurzlebige Azure-Speech-Tokens (10 Minuten gültig).
 * Der geheime Schlüssel bleibt auf dem Server; Browser bekommen nur Tokens.
 */
export interface SpeechToken {
  token: string;
  region: string;
  expiresAt: number;
}

export async function issueSpeechToken(opts: {
  key: string;
  region: string;
  fetchImpl?: typeof fetch;
}): Promise<SpeechToken> {
  const f = opts.fetchImpl ?? fetch;
  const res = await f(`https://${opts.region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`, {
    method: "POST",
    headers: { "Ocp-Apim-Subscription-Key": opts.key, "Content-Length": "0" },
  });
  if (!res.ok) throw new Error(`Azure Speech Token ${res.status}`);
  const token = await res.text();
  // Wir erneuern nach 9 Minuten, damit nie ein abgelaufenes Token benutzt wird.
  return { token, region: opts.region, expiresAt: Date.now() + 9 * 60 * 1000 };
}

/** Cacht ein Token serverseitig, damit nicht jeder Aufruf Azure fragt. */
export function createSpeechTokenCache(opts: { key: string; region: string; fetchImpl?: typeof fetch }) {
  let current: SpeechToken | null = null;
  let pending: Promise<SpeechToken> | null = null;
  return async function getToken(): Promise<SpeechToken> {
    if (current && current.expiresAt > Date.now()) return current;
    if (!pending) {
      pending = issueSpeechToken(opts)
        .then((t) => (current = t))
        .finally(() => (pending = null));
    }
    return pending;
  };
}
