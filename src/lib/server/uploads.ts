import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

/**
 * Dateien (Chat-Anhänge, Belege) liegen auf dem Server neben der Datenbank im Ordner „uploads“
 * (im Docker-Volume, wird mitgesichert). Nie öffentlich erreichbar – nur über geprüfte Adressen.
 */
export const MAX_UPLOAD = 15 * 1024 * 1024;
const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic", "image/heif": "heif", "image/gif": "gif",
  "application/pdf": "pdf",
};

export function uploadRoot(): string {
  const dbFile = process.env.DATABASE_PATH || "./data/beyourself.db";
  return path.join(path.dirname(path.resolve(dbFile)), "uploads");
}

export interface StoredFile { path: string; name: string; type: string; size: number }

export class UploadError extends Error {}

/** Speichert eine hochgeladene Datei; prüft Größe und Art (Bilder, PDF). */
export async function storeUpload(file: File, folder: "chat" | "belege"): Promise<StoredFile> {
  if (!file || typeof file.arrayBuffer !== "function" || file.size === 0) throw new UploadError("Keine Datei gewählt.");
  if (file.size > MAX_UPLOAD) throw new UploadError("Die Datei ist zu groß (höchstens 15 MB).");
  const type = (file.type || "").toLowerCase();
  const ext = ALLOWED[type] ?? (/\.(heic|heif)$/i.test(file.name) ? "heic" : undefined);
  if (!ext) throw new UploadError("Erlaubt sind Fotos (JPG, PNG, HEIC) und PDF-Dateien.");
  const dir = path.join(uploadRoot(), folder, new Date().toISOString().slice(0, 7));
  fs.mkdirSync(dir, { recursive: true });
  const rel = path.join(folder, new Date().toISOString().slice(0, 7), `${randomUUID()}.${ext}`);
  fs.writeFileSync(path.join(uploadRoot(), rel), Buffer.from(await file.arrayBuffer()));
  const name = file.name.replace(/[^\p{L}\p{N}._ -]/gu, "_").slice(0, 120) || `datei.${ext}`;
  return { path: rel, name, type: type || "image/heic", size: file.size };
}

export function readUpload(rel: string): Buffer | null {
  const full = path.resolve(uploadRoot(), rel);
  if (!full.startsWith(path.resolve(uploadRoot()) + path.sep)) return null; // kein Ausbrechen aus dem Ordner
  try { return fs.readFileSync(full); } catch { return null; }
}

export function deleteUpload(rel: string): void {
  const full = path.resolve(uploadRoot(), rel);
  if (full.startsWith(path.resolve(uploadRoot()) + path.sep)) fs.rmSync(full, { force: true });
}
