import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";

/**
 * Belege der Fahrschule (Ausgaben): per Handy fotografieren oder als PDF hochladen,
 * nach Zeitraum filtern und für den Steuerberater exportieren – jede Datei einzeln (ZIP) plus Übersicht (CSV).
 * Exportierte Belege werden markiert (Datum des Exports).
 */
export const RECEIPT_SCHEMA = `
CREATE TABLE IF NOT EXISTS receipts (
  id          TEXT PRIMARY KEY,
  day         TEXT NOT NULL,
  amount_cents INTEGER,
  vat_rate    INTEGER,
  supplier    TEXT NOT NULL DEFAULT '',
  category    TEXT NOT NULL DEFAULT 'sonstiges',
  payment     TEXT NOT NULL DEFAULT '',
  note        TEXT NOT NULL DEFAULT '',
  file_path   TEXT NOT NULL,
  file_name   TEXT NOT NULL,
  file_type   TEXT NOT NULL,
  file_size   INTEGER NOT NULL,
  created_by  TEXT,
  created_at  INTEGER NOT NULL,
  exported_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_receipts_day ON receipts(day);
`;

export const RECEIPT_CATEGORIES = {
  kraftstoff: "Kraftstoff / Laden", fahrzeug: "Fahrzeug & Werkstatt", versicherung: "Versicherung", miete: "Miete & Nebenkosten",
  buero: "Büro & Material", lernmaterial: "Lernmaterial & Lizenzen", telefon: "Telefon & Internet", werbung: "Werbung",
  fortbildung: "Fortbildung", gebuehren: "Gebühren (TÜV, Ämter)", sonstiges: "Sonstiges",
} as const;
export type ReceiptCategory = keyof typeof RECEIPT_CATEGORIES;
export const PAYMENTS = { bar: "Bar", karte: "Karte", ueberweisung: "Überweisung", lastschrift: "Lastschrift", privat: "Privat ausgelegt" } as const;

export interface Receipt {
  id: string; day: string; amountCents: number | null; vatRate: number | null; supplier: string; category: ReceiptCategory;
  payment: string; note: string; filePath: string; fileName: string; fileType: string; fileSize: number; createdAt: number; exportedAt: number | null;
}

type Row = Record<string, unknown>;
const map = (r: Row): Receipt => ({
  id: r.id as string, day: r.day as string, amountCents: r.amount_cents == null ? null : Number(r.amount_cents), vatRate: r.vat_rate == null ? null : Number(r.vat_rate),
  supplier: r.supplier as string, category: (r.category as ReceiptCategory) in RECEIPT_CATEGORIES ? (r.category as ReceiptCategory) : "sonstiges",
  payment: r.payment as string, note: r.note as string, filePath: r.file_path as string, fileName: r.file_name as string, fileType: r.file_type as string,
  fileSize: Number(r.file_size), createdAt: Number(r.created_at), exportedAt: r.exported_at == null ? null : Number(r.exported_at),
});

export interface ReceiptInput {
  day: string; amountCents: number | null; vatRate: number | null; supplier: string; category: string; payment: string; note: string;
  file: { path: string; name: string; type: string; size: number }; createdBy: string;
}

export function addReceipt(db: Database.Database, r: ReceiptInput, now = Date.now()): Receipt {
  const id = randomUUID();
  const cat = r.category in RECEIPT_CATEGORIES ? r.category : "sonstiges";
  const pay = r.payment in PAYMENTS ? r.payment : "";
  const vat = r.vatRate !== null && [0, 7, 19].includes(r.vatRate) ? r.vatRate : null;
  db.prepare(`INSERT INTO receipts (id,day,amount_cents,vat_rate,supplier,category,payment,note,file_path,file_name,file_type,file_size,created_by,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id, r.day, r.amountCents, vat, r.supplier.trim().slice(0, 120), cat, pay, r.note.trim().slice(0, 500),
    r.file.path, r.file.name, r.file.type, r.file.size, r.createdBy, now);
  return getReceipt(db, id)!;
}

export function getReceipt(db: Database.Database, id: string): Receipt | undefined {
  const r = db.prepare(`SELECT * FROM receipts WHERE id = ?`).get(id) as Row | undefined;
  return r ? map(r) : undefined;
}

export function listReceipts(db: Database.Database, from: string, to: string, onlyNew = false): Receipt[] {
  return (db.prepare(`SELECT * FROM receipts WHERE day >= ? AND day <= ? ${onlyNew ? "AND exported_at IS NULL" : ""} ORDER BY day DESC, created_at DESC`)
    .all(from, to) as Row[]).map(map);
}

export function updateReceipt(db: Database.Database, id: string, p: Partial<Pick<Receipt, "day" | "amountCents" | "vatRate" | "supplier" | "category" | "payment" | "note">>): void {
  const cur = getReceipt(db, id);
  if (!cur) return;
  const n = { ...cur, ...Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined)) } as Receipt;
  db.prepare(`UPDATE receipts SET day = ?, amount_cents = ?, vat_rate = ?, supplier = ?, category = ?, payment = ?, note = ? WHERE id = ?`)
    .run(n.day, n.amountCents, n.vatRate, n.supplier.slice(0, 120), n.category in RECEIPT_CATEGORIES ? n.category : "sonstiges", n.payment, n.note.slice(0, 500), id);
}

export function deleteReceipt(db: Database.Database, id: string): Receipt | undefined {
  const r = getReceipt(db, id);
  if (r) db.prepare(`DELETE FROM receipts WHERE id = ?`).run(id);
  return r;
}

export function markExported(db: Database.Database, ids: string[], now = Date.now()): void {
  const up = db.prepare(`UPDATE receipts SET exported_at = ? WHERE id = ?`);
  db.transaction(() => { for (const id of ids) up.run(now, id); })();
}

const euro = (c: number | null) => (c === null ? "" : (c / 100).toFixed(2).replace(".", ","));
const safe = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

/** Dateiname im Export: 2026-11-01_Shell_45-90EUR_Kraftstoff_ab12.jpg */
export function exportName(r: Receipt): string {
  const ext = r.fileName.includes(".") ? r.fileName.split(".").pop()!.toLowerCase() : r.fileType.split("/")[1] ?? "dat";
  return [r.day, safe(r.supplier) || "Beleg", r.amountCents !== null ? `${euro(r.amountCents).replace(",", "-")}EUR` : "", safe(RECEIPT_CATEGORIES[r.category]), r.id.slice(0, 4)]
    .filter(Boolean).join("_") + `.${ext}`;
}

/** Übersicht für den Steuerberater (Excel öffnet das direkt; Semikolon, deutsche Kommazahlen). */
export function receiptsCsv(list: Receipt[]): string {
  const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const head = ["Datum", "Firma", "Kategorie", "Betrag brutto (EUR)", "MwSt-Satz", "Zahlungsart", "Notiz", "Datei"];
  const rows = [...list].sort((a, b) => a.day.localeCompare(b.day)).map((r) => [
    r.day.split("-").reverse().join("."), q(r.supplier), q(RECEIPT_CATEGORIES[r.category]), euro(r.amountCents),
    r.vatRate === null ? "" : `${r.vatRate} %`, q(PAYMENTS[r.payment as keyof typeof PAYMENTS] ?? ""), q(r.note), q(exportName(r)),
  ].join(";"));
  const sum = list.reduce((a, r) => a + (r.amountCents ?? 0), 0);
  return "﻿" + [head.join(";"), ...rows, "", `;Summe;;${euro(sum)};;;;`].join("\r\n");
}
