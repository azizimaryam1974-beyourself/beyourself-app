import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";

/**
 * Unterlagen der Schüler (Ausweis, Aufenthaltstitel, Sehtest …) – als Foto/PDF hochgeladen.
 * Grundlage: Liste der Stadt Kassel für den Führerscheinantrag (Ersterteilung + Umschreibung).
 * Die Fahrschule prüft jede Datei: „geprüft“ oder „bitte neu hochladen“.
 */
export const DOCS_SCHEMA = `
CREATE TABLE IF NOT EXISTS student_documents (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  file_path   TEXT NOT NULL,
  file_name   TEXT NOT NULL,
  file_type   TEXT NOT NULL,
  file_size   INTEGER NOT NULL,
  status      TEXT NOT NULL DEFAULT 'neu',
  note        TEXT NOT NULL DEFAULT '',
  uploaded_at INTEGER NOT NULL,
  checked_at  INTEGER
);
CREATE INDEX IF NOT EXISTS idx_student_documents_user ON student_documents(user_id, type);
`;

export const DOC_TYPES = ["ausweis", "aufenthaltstitel", "meldebescheinigung", "sehtest", "erstehilfe", "passbild", "fuehrerschein_ausland", "uebersetzung"] as const;
export type DocType = (typeof DOC_TYPES)[number];
export const isDocType = (v: string): v is DocType => (DOC_TYPES as readonly string[]).includes(v);

export const DOC_INFO: Record<DocType, { label: string; who: string; hint: string; umschreibungOnly?: boolean }> = {
  ausweis: { label: "Personalausweis oder Reisepass", who: "alle", hint: "Vorder- und Rückseite, gut lesbar und hell. Ohne Ausweis gibt es keine Fahrstunden." },
  aufenthaltstitel: { label: "Aufenthaltstitel", who: "nur ohne deutschen oder EU-Pass", hint: "Die Karte (eAT) – Vorder- und Rückseite." },
  meldebescheinigung: { label: "Meldebescheinigung", who: "nur wenn du einen Reisepass statt Personalausweis hast", hint: "Bekommst du im Bürgerbüro. Im Reisepass steht keine Adresse – damit zeigst du, dass du in Kassel wohnst." },
  sehtest: { label: "Sehtest", who: "alle", hint: "Von einer amtlich anerkannten Sehteststelle (z. B. Optiker), nicht älter als 2 Jahre." },
  erstehilfe: { label: "Erste-Hilfe-Kurs", who: "alle (nicht bei Umschreibung)", hint: "9 Unterrichtseinheiten, nur Kurs vor Ort – Online-Kurse zählen nicht." },
  passbild: { label: "Biometrisches Passbild", who: "alle", hint: "Foto hier hochladen ist eine Hilfe – das echte Passbild auf Papier brauchst du trotzdem für die Behörde." },
  fuehrerschein_ausland: { label: "Ausländischer Führerschein", who: "nur bei Umschreibung", hint: "Vorder- und Rückseite.", umschreibungOnly: true },
  uebersetzung: { label: "Übersetzung des Führerscheins", who: "nur bei Umschreibung, falls verlangt", hint: "Falls die Führerscheinstelle eine Übersetzung verlangt (ADAC oder vereidigter Übersetzer).", umschreibungOnly: true },
};

export type DocStatus = "neu" | "ok" | "abgelehnt";
export const DOC_STATUS_LABEL: Record<DocStatus, string> = { neu: "wird geprüft", ok: "geprüft ✓", abgelehnt: "bitte neu hochladen" };

export interface StudentDoc { id: string; userId: string; type: DocType; path: string; name: string; fileType: string; size: number; status: DocStatus; note: string; uploadedAt: number; checkedAt: number | null }

type Row = Record<string, unknown>;
const map = (r: Row): StudentDoc => ({
  id: r.id as string, userId: r.user_id as string, type: r.type as DocType, path: r.file_path as string, name: r.file_name as string,
  fileType: r.file_type as string, size: Number(r.file_size), status: r.status as DocStatus, note: r.note as string,
  uploadedAt: Number(r.uploaded_at), checkedAt: r.checked_at == null ? null : Number(r.checked_at),
});

export function addDoc(db: Database.Database, d: { userId: string; type: DocType; path: string; name: string; fileType: string; size: number }, now = Date.now()): StudentDoc {
  const id = randomUUID();
  db.prepare(`INSERT INTO student_documents (id, user_id, type, file_path, file_name, file_type, file_size, uploaded_at) VALUES (?,?,?,?,?,?,?,?)`)
    .run(id, d.userId, d.type, d.path, d.name, d.fileType, d.size, now);
  return getDoc(db, id)!;
}
export function getDoc(db: Database.Database, id: string): StudentDoc | null {
  const r = db.prepare(`SELECT * FROM student_documents WHERE id = ?`).get(id) as Row | undefined;
  return r ? map(r) : null;
}
export function listDocs(db: Database.Database, userId: string): StudentDoc[] {
  return (db.prepare(`SELECT * FROM student_documents WHERE user_id = ? ORDER BY uploaded_at`).all(userId) as Row[]).map(map);
}
/** Neue, noch nicht geprüfte Unterlagen aller Schüler (für Glocke/Übersicht). */
export function docsToCheck(db: Database.Database): Array<{ userId: string; name: string; count: number }> {
  return db.prepare(`SELECT d.user_id AS userId, u.name, COUNT(*) AS count FROM student_documents d JOIN users u ON u.id = d.user_id
    WHERE d.status = 'neu' GROUP BY d.user_id ORDER BY MIN(d.uploaded_at)`).all() as Array<{ userId: string; name: string; count: number }>;
}
export function setDocStatus(db: Database.Database, id: string, status: DocStatus, note = "", now = Date.now()): void {
  db.prepare(`UPDATE student_documents SET status = ?, note = ?, checked_at = ? WHERE id = ?`).run(status, note.slice(0, 300), status === "neu" ? null : now, id);
}
/** Löscht den Eintrag, gibt den Dateipfad zurück (Datei löscht der Aufrufer). */
export function removeDoc(db: Database.Database, id: string): string | null {
  const d = getDoc(db, id);
  if (!d) return null;
  db.prepare(`DELETE FROM student_documents WHERE id = ?`).run(id);
  return d.path;
}
/** Hat der Schüler einen Ausweis hochgeladen, der nicht abgelehnt wurde? */
export function hasIdDocument(db: Database.Database, userId: string): boolean {
  return !!db.prepare(`SELECT 1 FROM student_documents WHERE user_id = ? AND type = 'ausweis' AND status != 'abgelehnt' LIMIT 1`).get(userId);
}
