import type Database from "better-sqlite3";

/**
 * Push-Benachrichtigungen aufs Handy (iPhone + Android) über den Expo-Push-Dienst.
 * Die App meldet ihr Geräte-Kennzeichen (Expo-Push-Token) an, sobald jemand eingeloggt ist.
 * Jede Mitteilung im Konto (Buchung, Erinnerung, Chat …) geht zusätzlich als Push raus.
 */
export const PUSH_SCHEMA = `
CREATE TABLE IF NOT EXISTS push_tokens (
  token      TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform   TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  last_seen  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_push_user ON push_tokens(user_id);
`;

export const isExpoToken = (t: unknown): t is string => typeof t === "string" && /^Expo(nent)?PushToken\[[A-Za-z0-9_-]{10,}\]$/.test(t);

export function registerPushToken(db: Database.Database, userId: string, token: string, platform: string, now = Date.now()): void {
  // Ein Gerät gehört immer dem, der zuletzt darauf eingeloggt war.
  db.prepare(`INSERT INTO push_tokens (token, user_id, platform, created_at, last_seen) VALUES (?,?,?,?,?)
    ON CONFLICT(token) DO UPDATE SET user_id = excluded.user_id, platform = excluded.platform, last_seen = excluded.last_seen`)
    .run(token, userId, platform.slice(0, 20), now, now);
}

export function removePushToken(db: Database.Database, token: string): void {
  db.prepare(`DELETE FROM push_tokens WHERE token = ?`).run(token);
}

/** Wohin soll ein Tipp auf die Mitteilung führen? */
export function pushTarget(role: string, title: string, bookingId: string | null): string {
  if (/^Nachricht von /.test(title)) return "/verwaltung/nachrichten";
  if (/Nachricht von der Fahrschule/.test(title)) return "/nachrichten";
  if (role === "teacher") return bookingId ? "/verwaltung/kalender" : "/verwaltung/uebersicht";
  return bookingId ? "/termine" : "/konto";
}

/** Push an alle Geräte eines Nutzers. Läuft im Hintergrund; Fehler stören die App nie. */
export function pushToUser(db: Database.Database, userId: string, title: string, body: string, bookingId: string | null = null): void {
  let rows: Array<{ token: string }> = [];
  let role = "student";
  try {
    rows = db.prepare(`SELECT token FROM push_tokens WHERE user_id = ?`).all(userId) as Array<{ token: string }>;
    role = (db.prepare(`SELECT role FROM users WHERE id = ?`).get(userId) as { role: string } | undefined)?.role ?? "student";
  } catch { return; }
  if (!rows.length || process.env.PUSH_DISABLED === "1") return;
  const url = pushTarget(role, title, bookingId);
  const messages = rows.map((r) => ({ to: r.token, title: title.slice(0, 120), body: body.slice(0, 300), sound: "default", data: { url }, priority: "high", channelId: "default" }));
  void fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST", headers: { "content-type": "application/json", accept: "application/json" }, body: JSON.stringify(messages),
  }).then(async (res) => {
    const j = (await res.json().catch(() => ({}))) as { data?: Array<{ status: string; details?: { error?: string } }> };
    // Abgemeldete/gelöschte Apps: Kennzeichen entfernen
    j.data?.forEach((d, i) => { if (d.status === "error" && d.details?.error === "DeviceNotRegistered") removePushToken(db, rows[i].token); });
  }).catch((e) => console.error("[push]", (e as Error).message));
}
