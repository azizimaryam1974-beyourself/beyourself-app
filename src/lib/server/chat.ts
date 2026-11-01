import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";

/**
 * Chat zwischen Fahrschüler und Fahrschule – ein Gespräch je Schüler.
 * - Anhänge: Foto oder PDF (Datei liegt in uploads/chat, siehe uploads.ts)
 * - Antwort auf eine bestimmte Nachricht (reply_to)
 * - Schüler kann den Chat für sich leeren – bei der Fahrschule bleibt alles sichtbar.
 */
export const CHAT_SCHEMA = `
CREATE TABLE IF NOT EXISTS chat_messages (
  id          TEXT PRIMARY KEY,
  student_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender      TEXT NOT NULL CHECK (sender IN ('student','school')),
  sender_id   TEXT NOT NULL,
  body        TEXT NOT NULL DEFAULT '',
  reply_to    TEXT,
  file_path   TEXT,
  file_name   TEXT,
  file_type   TEXT,
  file_size   INTEGER,
  created_at  INTEGER NOT NULL,
  read_at     INTEGER
);
CREATE INDEX IF NOT EXISTS idx_chat_student ON chat_messages(student_id, created_at);
CREATE TABLE IF NOT EXISTS chat_threads (
  student_id         TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  student_cleared_at INTEGER NOT NULL DEFAULT 0,
  mailed_school_at   INTEGER NOT NULL DEFAULT 0,
  mailed_student_at  INTEGER NOT NULL DEFAULT 0
);
`;

export type Side = "student" | "school";
export interface ChatMessage {
  id: string; studentId: string; sender: Side; body: string; replyTo: string | null;
  file: { name: string; type: string; size: number } | null; createdAt: number; readAt: number | null;
  /** Kurzfassung der beantworteten Nachricht */
  quote: { id: string; sender: Side; text: string } | null;
}

type Row = Record<string, unknown>;
const preview = (r: Row | undefined) => r ? ((r.body as string) || (r.file_name ? `📎 ${r.file_name}` : "")).slice(0, 140) : "";

function map(db: Database.Database, r: Row): ChatMessage {
  const q = r.reply_to ? db.prepare(`SELECT id, sender, body, file_name FROM chat_messages WHERE id = ?`).get(r.reply_to) as Row | undefined : undefined;
  return {
    id: r.id as string, studentId: r.student_id as string, sender: r.sender as Side, body: r.body as string, replyTo: (r.reply_to as string) ?? null,
    file: r.file_path ? { name: r.file_name as string, type: r.file_type as string, size: Number(r.file_size) } : null,
    createdAt: Number(r.created_at), readAt: r.read_at == null ? null : Number(r.read_at),
    quote: q ? { id: q.id as string, sender: q.sender as Side, text: preview(q) } : null,
  };
}

function thread(db: Database.Database, studentId: string) {
  db.prepare(`INSERT OR IGNORE INTO chat_threads (student_id) VALUES (?)`).run(studentId);
  return db.prepare(`SELECT * FROM chat_threads WHERE student_id = ?`).get(studentId) as { student_cleared_at: number; mailed_school_at: number; mailed_student_at: number };
}

/** Nachrichten für eine Seite (Schüler sieht nichts vor dem eigenen „Chat leeren“). */
export function listMessages(db: Database.Database, studentId: string, side: Side, after = 0, limit = 300): ChatMessage[] {
  const from = Math.max(after, side === "student" ? thread(db, studentId).student_cleared_at : 0);
  const rows = db.prepare(`SELECT * FROM (SELECT * FROM chat_messages WHERE student_id = ? AND created_at > ? ORDER BY created_at DESC LIMIT ?) ORDER BY created_at`)
    .all(studentId, from, limit) as Row[];
  return rows.map((r) => map(db, r));
}

export function getMessage(db: Database.Database, id: string): (ChatMessage & { filePath: string | null }) | undefined {
  const r = db.prepare(`SELECT * FROM chat_messages WHERE id = ?`).get(id) as Row | undefined;
  return r ? { ...map(db, r), filePath: (r.file_path as string) ?? null } : undefined;
}

export function sendMessage(db: Database.Database, m: {
  studentId: string; sender: Side; senderId: string; body: string; replyTo?: string | null;
  file?: { path: string; name: string; type: string; size: number } | null;
}, now = Date.now()): ChatMessage {
  const body = m.body.trim().slice(0, 4000);
  if (!body && !m.file) throw new Error("Leere Nachricht");
  let replyTo: string | null = null;
  if (m.replyTo) {
    const r = db.prepare(`SELECT id FROM chat_messages WHERE id = ? AND student_id = ?`).get(m.replyTo, m.studentId) as Row | undefined;
    replyTo = r ? (r.id as string) : null;
  }
  thread(db, m.studentId);
  const id = randomUUID();
  db.prepare(`INSERT INTO chat_messages (id,student_id,sender,sender_id,body,reply_to,file_path,file_name,file_type,file_size,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id, m.studentId, m.sender, m.senderId, body, replyTo, m.file?.path ?? null, m.file?.name ?? null, m.file?.type ?? null, m.file?.size ?? null, now);
  return getMessage(db, id)!;
}

/** Gelesen: alle Nachrichten der anderen Seite. */
export function markRead(db: Database.Database, studentId: string, reader: Side, now = Date.now()): void {
  db.prepare(`UPDATE chat_messages SET read_at = ? WHERE student_id = ? AND sender != ? AND read_at IS NULL`).run(now, studentId, reader);
}

/** Schüler leert den Chat für sich. Die Fahrschule sieht weiterhin alles. */
export function clearForStudent(db: Database.Database, studentId: string, now = Date.now()): void {
  thread(db, studentId);
  db.prepare(`UPDATE chat_threads SET student_cleared_at = ? WHERE student_id = ?`).run(now, studentId);
}

export function unreadForStudent(db: Database.Database, studentId: string): number {
  const t = thread(db, studentId);
  return (db.prepare(`SELECT COUNT(*) AS n FROM chat_messages WHERE student_id = ? AND sender = 'school' AND read_at IS NULL AND created_at > ?`)
    .get(studentId, t.student_cleared_at) as { n: number }).n;
}
export function unreadForSchool(db: Database.Database): number {
  return (db.prepare(`SELECT COUNT(*) AS n FROM chat_messages WHERE sender = 'student' AND read_at IS NULL`).get() as { n: number }).n;
}

export interface ThreadSummary { studentId: string; name: string; last: string; lastAt: number; lastSender: Side; unread: number }
export function listThreads(db: Database.Database): ThreadSummary[] {
  const rows = db.prepare(`SELECT u.id, u.name, m.body, m.file_name, m.created_at, m.sender,
      (SELECT COUNT(*) FROM chat_messages x WHERE x.student_id = u.id AND x.sender = 'student' AND x.read_at IS NULL) AS unread
    FROM users u JOIN chat_messages m ON m.id = (SELECT id FROM chat_messages WHERE student_id = u.id ORDER BY created_at DESC LIMIT 1)
    ORDER BY m.created_at DESC`).all() as Row[];
  return rows.map((r) => ({ studentId: r.id as string, name: r.name as string, last: preview(r), lastAt: Number(r.created_at), lastSender: r.sender as Side, unread: Number(r.unread) }));
}

/** E-Mail-Hinweis höchstens alle 15 Minuten je Richtung (sonst bei jeder Nachricht eine Mail). */
export function shouldMail(db: Database.Database, studentId: string, to: Side, now = Date.now()): boolean {
  const t = thread(db, studentId);
  const last = to === "school" ? t.mailed_school_at : t.mailed_student_at;
  if (now - last < 15 * 60_000) return false;
  db.prepare(`UPDATE chat_threads SET ${to === "school" ? "mailed_school_at" : "mailed_student_at"} = ? WHERE student_id = ?`).run(now, studentId);
  return true;
}
