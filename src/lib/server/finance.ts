import type Database from "better-sqlite3";
import { parseLines } from "./booking";

/**
 * Alle Geldbewegungen als eine Liste (für „Finanzen“ und die Zahlen der Übersicht).
 * Einnahme = Geld, das wirklich angekommen ist (Zuflussprinzip): bezahlte Buchungen ohne den Teil, der mit Guthaben
 * verrechnet wurde, plus Einzahlungen aufs Guthaben (Vorauszahlung). Auszahlungen von Guthaben sind negativ.
 * Offen = bestätigte Buchungen, die noch nicht bezahlt sind.
 * TÜV-Gebühren werden getrennt ausgewiesen (durchlaufendes Geld).
 */

export type MoneyCategory = "fahrten" | "grundbetrag" | "pruefungen" | "sprachpaket" | "guthaben" | "sonstiges";
export const MONEY_CATEGORY_LABEL: Record<MoneyCategory, string> = {
  fahrten: "Fahrstunden", grundbetrag: "Grundbeträge", pruefungen: "Prüfungen", sprachpaket: "Sprachpakete",
  guthaben: "Guthaben (Einzahlung/Auszahlung)", sonstiges: "Sonstiges",
};
export const PROVIDER_LABEL: Record<string, string> = {
  stripe: "Karte/Apple Pay", paypal: "PayPal", test: "Testzahlung", bar: "Bar/EC", ueberweisung: "Überweisung", guthaben: "Guthaben", "": "–",
};

export interface MoneyEntry {
  id: string; kind: "einnahme" | "offen"; at: number; deadline: number | null;
  userId: string; userName: string; title: string; category: MoneyCategory; provider: string;
  schoolCents: number; tuevCents: number; totalCents: number;
}

type Row = Record<string, unknown>;

function categorize(offerId: string, examId: unknown): MoneyCategory {
  if (examId) return "pruefungen";
  if (offerId.startsWith("drive-")) return "fahrten";
  if (offerId === "fee-grundbetrag") return "grundbetrag";
  if (offerId === "sprachpaket") return "sprachpaket";
  return "sonstiges";
}

function splitTuev(money: number, lines: string): { school: number; tuev: number } {
  const tuevLines = parseLines(lines).filter((l) => l.part === "tuev").reduce((a, l) => a + l.cents, 0);
  const tuev = Math.min(Math.max(0, money), tuevLines);
  return { school: money - tuev, tuev };
}

export function moneyEntries(db: Database.Database): MoneyEntry[] {
  const out: MoneyEntry[] = [];
  const paid = db.prepare(`SELECT b.id, b.offer_id, b.title, b.price_cents, b.credit_cents, b.paid_at, b.exam_id, b.lines, b.provider, b.user_id, u.name
    FROM bookings b JOIN users u ON u.id = b.user_id WHERE b.paid_at IS NOT NULL`).all() as Row[];
  for (const r of paid) {
    const money = Math.max(0, Number(r.price_cents) - Number(r.credit_cents ?? 0));
    if (money <= 0) continue; // komplett mit Guthaben bezahlt → das Geld wurde schon bei der Einzahlung gezählt
    const { school, tuev } = splitTuev(money, r.lines as string);
    out.push({ id: r.id as string, kind: "einnahme", at: Number(r.paid_at), deadline: null, userId: r.user_id as string, userName: r.name as string,
      title: r.title as string, category: categorize(r.offer_id as string, r.exam_id), provider: (r.provider as string) ?? "",
      schoolCents: school, tuevCents: tuev, totalCents: money });
  }
  const moves = db.prepare(`SELECT c.id, c.user_id, c.amount_cents, c.reason, c.note, c.created_at, u.name FROM credit_ledger c JOIN users u ON u.id = c.user_id
    WHERE c.reason IN ('deposit','payout')`).all() as Row[];
  for (const r of moves) {
    const cents = Number(r.amount_cents);
    const deposit = r.reason === "deposit";
    const note = (r.note as string) || "";
    const method = deposit ? (/^bar\b/i.test(note) ? "bar" : "ueberweisung") : "ueberweisung";
    out.push({ id: r.id as string, kind: "einnahme", at: Number(r.created_at), deadline: null, userId: r.user_id as string, userName: r.name as string,
      title: deposit ? `Einzahlung aufs Guthaben${note ? ` · ${note}` : ""}` : `Guthaben ausgezahlt${note ? ` · ${note}` : ""}`,
      category: "guthaben", provider: method, schoolCents: cents, tuevCents: 0, totalCents: cents });
  }
  const open = db.prepare(`SELECT b.id, b.offer_id, b.title, b.price_cents, b.credit_cents, b.created_at, b.pay_deadline, b.exam_id, b.lines, b.user_id, u.name
    FROM bookings b JOIN users u ON u.id = b.user_id WHERE b.status = 'awaiting_payment'`).all() as Row[];
  for (const r of open) {
    const money = Math.max(0, Number(r.price_cents) - Number(r.credit_cents ?? 0));
    const { school, tuev } = splitTuev(money, r.lines as string);
    out.push({ id: r.id as string, kind: "offen", at: Number(r.created_at), deadline: r.pay_deadline == null ? null : Number(r.pay_deadline),
      userId: r.user_id as string, userName: r.name as string, title: r.title as string, category: categorize(r.offer_id as string, r.exam_id),
      provider: "", schoolCents: school, tuevCents: tuev, totalCents: money });
  }
  return out.sort((a, b) => b.at - a.at);
}

export interface MoneyFilter { kind?: "einnahme" | "offen" | "alle"; from?: number; to?: number; category?: MoneyCategory | ""; provider?: string; userId?: string; q?: string }

export function filterMoney(list: MoneyEntry[], f: MoneyFilter): MoneyEntry[] {
  const q = (f.q ?? "").trim().toLowerCase();
  return list.filter((e) =>
    (!f.kind || f.kind === "alle" || e.kind === f.kind) &&
    (f.from == null || e.at >= f.from) && (f.to == null || e.at < f.to) &&
    (!f.category || e.category === f.category) &&
    (!f.provider || e.provider === f.provider) &&
    (!f.userId || e.userId === f.userId) &&
    (!q || e.userName.toLowerCase().includes(q) || e.title.toLowerCase().includes(q)));
}

export function sumMoney(list: MoneyEntry[]): { school: number; tuev: number; total: number; count: number } {
  return list.reduce((s, e) => ({ school: s.school + e.schoolCents, tuev: s.tuev + e.tuevCents, total: s.total + e.totalCents, count: s.count + 1 }), { school: 0, tuev: 0, total: 0, count: 0 });
}

export function moneyCsv(list: MoneyEntry[]): string {
  const eur = (c: number) => (c / 100).toFixed(2).replace(".", ",");
  const d = (t: number) => new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric" }).format(t);
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const rows = [["Datum", "Art", "Schüler", "Leistung", "Bereich", "Zahlungsart", "Fahrschule €", "TÜV €", "Gesamt €"].join(";")];
  for (const e of list) rows.push([d(e.at), e.kind === "offen" ? "offen" : "Einnahme", esc(e.userName), esc(e.title), esc(MONEY_CATEGORY_LABEL[e.category]),
    esc(PROVIDER_LABEL[e.provider] ?? e.provider), eur(e.schoolCents), eur(e.tuevCents), eur(e.totalCents)].join(";"));
  const s = sumMoney(list);
  rows.push(["", "", "", "Summe", "", "", eur(s.school), eur(s.tuev), eur(s.total)].join(";"));
  return "﻿" + rows.join("\r\n");
}

/** Bankverbindung, die Schülern für Überweisungen aufs Guthaben angezeigt wird (in den Einstellungen änderbar). */
export function getBankDetails(db: Database.Database): string {
  const r = db.prepare(`SELECT value FROM settings WHERE key = 'bank_details'`).get() as { value: string } | undefined;
  return r?.value ?? "";
}
export function saveBankDetails(db: Database.Database, text: string): void {
  db.prepare(`INSERT INTO settings (key,value) VALUES ('bank_details', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(text.trim().slice(0, 500));
}
