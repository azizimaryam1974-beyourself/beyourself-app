/**
 * Einfacher Schutz gegen Passwort-Raten (im Speicher, reicht für einen
 * einzelnen Server-Prozess). Fehlversuche werden pro Schlüssel gezählt;
 * nach `max` Fehlversuchen innerhalb von `windowMs` ist für den Rest des
 * Fensters gesperrt.
 */
export class RateLimiter {
  private hits = new Map<string, number[]>();
  constructor(
    private readonly max: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  private recent(key: string): number[] {
    const t = this.now();
    const list = (this.hits.get(key) ?? []).filter((x) => t - x < this.windowMs);
    if (list.length) this.hits.set(key, list);
    else this.hits.delete(key);
    return list;
  }

  /** Millisekunden bis zur Freigabe, 0 = erlaubt. */
  blockedFor(key: string): number {
    const list = this.recent(key);
    if (list.length < this.max) return 0;
    return list[0] + this.windowMs - this.now();
  }

  fail(key: string): void {
    const list = this.recent(key);
    list.push(this.now());
    this.hits.set(key, list);
  }

  reset(key: string): void {
    this.hits.delete(key);
  }
}

const g = globalThis as unknown as { __byLoginLimiter?: { email: RateLimiter; ip: RateLimiter } };

/** 5 Fehlversuche pro E-Mail bzw. 20 pro IP in 15 Minuten. */
export function loginLimiters() {
  if (!g.__byLoginLimiter) {
    g.__byLoginLimiter = { email: new RateLimiter(5, 15 * 60_000), ip: new RateLimiter(20, 15 * 60_000) };
  }
  return g.__byLoginLimiter;
}
