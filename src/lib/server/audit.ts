import type Database from "better-sqlite3";
import { createHash } from "node:crypto";

/**
 * Protokoll: zeichnet im Hintergrund alles auf, was in der App passiert – wer, wann, von wo, was, mit welchem Ergebnis.
 * Zum Nachvollziehen, wenn etwas schiefgeht (Streit um eine Buchung, Missbrauch, Fehler, Angriff).
 *
 * - Jede Zeile ist mit der vorherigen über einen Prüfwert (Hash-Kette) verbunden: Wird eine Zeile nachträglich
 *   geändert oder gelöscht, fällt das bei der Prüfung auf.
 * - Geheimes wird nie gespeichert (Passwörter, Schlüssel, Kartendaten). Nachrichtentexte nur als Länge.
 * - Aufbewahrung: AUDIT_RETENTION_DAYS (Standard 365 Tage), danach automatisch gelöscht.
 * - `tenant` ist für später, wenn mehrere Fahrschulen die App nutzen.
 */
export const AUDIT_SCHEMA = `
CREATE TABLE IF NOT EXISTS audit_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  at         INTEGER NOT NULL,
  tenant     TEXT NOT NULL DEFAULT 'beyourself',
  kind       TEXT NOT NULL,
  action     TEXT NOT NULL,
  actor_id   TEXT,
  actor_name TEXT,
  actor_role TEXT,
  ip         TEXT,
  ua         TEXT,
  target     TEXT,
  details    TEXT NOT NULL DEFAULT '{}',
  ok         INTEGER NOT NULL DEFAULT 1,
  hash       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_at ON audit_log(at);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_log(actor_id, at);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action, at);
`;

export type AuditKind = "auth" | "action" | "api" | "page" | "error" | "system" | "payment";

export interface AuditEvent {
  kind: AuditKind; action: string; actor?: { id: string; name: string; role: string } | null;
  ip?: string | null; ua?: string | null; target?: string | null; details?: Record<string, unknown>; ok?: boolean; at?: number;
}

export interface AuditRow { id: number; at: number; kind: AuditKind; action: string; actorId: string | null; actorName: string | null; actorRole: string | null;
  ip: string | null; ua: string | null; target: string | null; details: Record<string, unknown>; ok: boolean; hash: string }

const SECRET_KEY = /pass|token|secret|card|cvc|cvv|iban|key|signature|authorization|cookie/i;
const CONTENT_KEY = /^(body|text|message|nachricht|content)$/i;

/** Werte für das Protokoll aufbereiten: Geheimes schwärzen, Dateien nur beschreiben, lange Texte kürzen. */
export function sanitize(input: unknown, depth = 0): unknown {
  if (input == null || typeof input === "number" || typeof input === "boolean") return input;
  if (typeof input === "string") return input.length > 300 ? `${input.slice(0, 300)}… (${input.length} Zeichen)` : input;
  if (typeof File !== "undefined" && input instanceof File) return { datei: input.name, bytes: input.size, typ: input.type };
  if (typeof FormData !== "undefined" && input instanceof FormData) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of input.entries()) {
      if (k.startsWith("$ACTION") || k.startsWith("$ACTION_")) continue;
      const val = SECRET_KEY.test(k) ? "[geheim]" : CONTENT_KEY.test(k) && typeof v === "string" ? `[Text, ${v.length} Zeichen]` : sanitize(v, depth + 1);
      if (k in out) out[k] = ([] as unknown[]).concat(out[k], val); else out[k] = val;
    }
    return out;
  }
  if (depth > 3) return "[…]";
  if (Array.isArray(input)) return input.slice(0, 20).map((x) => sanitize(x, depth + 1));
  if (typeof input === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>).slice(0, 40)) {
      out[k] = SECRET_KEY.test(k) ? "[geheim]" : CONTENT_KEY.test(k) && typeof v === "string" ? `[Text, ${v.length} Zeichen]` : sanitize(v, depth + 1);
    }
    return out;
  }
  return String(input).slice(0, 100);
}

function rowHash(prev: string, r: { at: number; kind: string; action: string; actor_id: string | null; ip: string | null; target: string | null; details: string; ok: number }): string {
  return createHash("sha256").update(`${prev}|${r.at}|${r.kind}|${r.action}|${r.actor_id ?? ""}|${r.ip ?? ""}|${r.target ?? ""}|${r.details}|${r.ok}`).digest("hex");
}

/** Eintrag schreiben. Fehler beim Protokollieren dürfen die App nie stören. */
export function writeAudit(db: Database.Database, e: AuditEvent): void {
  try {
    const at = e.at ?? Date.now();
    const details = JSON.stringify(sanitize(e.details ?? {})).slice(0, 8000);
    const ok = e.ok === false ? 0 : 1;
    const row = { at, kind: e.kind, action: e.action.slice(0, 120), actor_id: e.actor?.id ?? null, ip: e.ip ?? null, target: e.target?.slice(0, 300) ?? null, details, ok };
    db.transaction(() => {
      const prev = (db.prepare(`SELECT hash FROM audit_log ORDER BY id DESC LIMIT 1`).get() as { hash: string } | undefined)?.hash ?? "start";
      db.prepare(`INSERT INTO audit_log (at, kind, action, actor_id, actor_name, actor_role, ip, ua, target, details, ok, hash) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
        .run(at, row.kind, row.action, row.actor_id, e.actor?.name ?? null, e.actor?.role ?? null, row.ip, e.ua?.slice(0, 200) ?? null, row.target, details, ok, rowHash(prev, row));
    })();
  } catch (err) {
    console.error("[protokoll] konnte nicht schreiben:", (err as Error).message);
  }
}

/** Prüft die Hash-Kette. Gibt die erste veränderte Zeile zurück (oder null = alles unverändert). */
export function verifyAudit(db: Database.Database): { checked: number; brokenAt: number | null } {
  const rows = db.prepare(`SELECT * FROM audit_log ORDER BY id`).iterate() as Iterable<Record<string, unknown>>;
  let prev: string | null = null, n = 0;
  for (const r of rows) {
    // Erste verbleibende Zeile nach dem automatischen Löschen alter Einträge: deren Vorgänger ist weg – sie wird als Start genommen.
    if (prev !== null) {
      const h = rowHash(prev, { at: Number(r.at), kind: r.kind as string, action: r.action as string, actor_id: (r.actor_id as string) ?? null, ip: (r.ip as string) ?? null,
        target: (r.target as string) ?? null, details: r.details as string, ok: Number(r.ok) });
      if (h !== r.hash) return { checked: n, brokenAt: Number(r.id) };
    }
    prev = r.hash as string; n++;
  }
  return { checked: n, brokenAt: null };
}

export interface AuditFilter { from?: number; to?: number; kind?: string; actorId?: string; q?: string; onlyErrors?: boolean; limit?: number; offset?: number }

export function listAudit(db: Database.Database, f: AuditFilter): { rows: AuditRow[]; total: number } {
  const where: string[] = [], args: unknown[] = [];
  if (f.from != null) { where.push("at >= ?"); args.push(f.from); }
  if (f.to != null) { where.push("at < ?"); args.push(f.to); }
  if (f.kind) { where.push("kind = ?"); args.push(f.kind); }
  if (f.actorId) { where.push("actor_id = ?"); args.push(f.actorId); }
  if (f.onlyErrors) where.push("ok = 0");
  if (f.q) { where.push("(action LIKE ? OR target LIKE ? OR details LIKE ? OR actor_name LIKE ? OR ip LIKE ?)"); const q = `%${f.q}%`; args.push(q, q, q, q, q); }
  const w = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const total = (db.prepare(`SELECT COUNT(*) AS n FROM audit_log ${w}`).get(...args) as { n: number }).n;
  const rows = (db.prepare(`SELECT * FROM audit_log ${w} ORDER BY id DESC LIMIT ? OFFSET ?`).all(...args, f.limit ?? 200, f.offset ?? 0) as Array<Record<string, unknown>>).map((r) => ({
    id: Number(r.id), at: Number(r.at), kind: r.kind as AuditKind, action: r.action as string, actorId: (r.actor_id as string) ?? null, actorName: (r.actor_name as string) ?? null,
    actorRole: (r.actor_role as string) ?? null, ip: (r.ip as string) ?? null, ua: (r.ua as string) ?? null, target: (r.target as string) ?? null,
    details: (() => { try { return JSON.parse(r.details as string) as Record<string, unknown>; } catch { return {}; } })(), ok: Number(r.ok) === 1, hash: r.hash as string,
  }));
  return { rows, total };
}

export function purgeAudit(db: Database.Database, days: number, now = Date.now()): number {
  return db.prepare(`DELETE FROM audit_log WHERE at < ?`).run(now - days * 86_400_000).changes;
}

export function auditCsv(rows: AuditRow[]): string {
  const d = (t: number) => new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", dateStyle: "short", timeStyle: "medium" }).format(t);
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const out = [["Nr", "Zeit", "Art", "Aktion", "Wer", "Rolle", "IP", "Ziel", "Ergebnis", "Details", "Gerät"].join(";")];
  for (const r of rows) out.push([r.id, d(r.at), r.kind, esc(r.action), esc(r.actorName ?? ""), r.actorRole ?? "", r.ip ?? "", esc(r.target ?? ""), r.ok ? "ok" : "FEHLER", esc(JSON.stringify(r.details)), esc(r.ua ?? "")].join(";"));
  return "﻿" + out.join("\r\n");
}
