import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";

/**
 * Buchungs-Logik (ohne Web, ohne Zahlungsanbieter – dadurch testbar).
 *
 * Ablauf Fahrstunde:
 *   Fahrschule gibt Termin frei (slot "open")
 *   → Schüler fragt an (booking "requested"; mehrere Schüler dürfen denselben Termin anfragen)
 *   → Fahrschule bestätigt eine Anfrage (booking "awaiting_payment", Termin "reserved",
 *     Zahlungsfrist z. B. 30 Min; alle anderen Anfragen für den Termin werden automatisch abgelehnt)
 *   → bezahlt (booking "paid", Termin "booked")  ODER  Frist vorbei (booking "expired", Termin wieder "open")
 */

export type OfferKind = "slot" | "product" | "language";
export type SlotStatus = "open" | "reserved" | "booked" | "closed";
export type BookingStatus = "requested" | "declined" | "awaiting_payment" | "expired" | "paid" | "cancelled" | "withdrawn";
export type TemplateKind = "confirm" | "decline" | "cancel";

export interface Offer {
  id: string; kind: OfferKind; title: string; description: string; durationMin: number;
  priceCents: number; needsApproval: boolean; active: boolean; sort: number;
}
export interface Slot {
  id: string; offerId: string; startsAt: number; endsAt: number; status: SlotStatus; note: string;
}
export interface Booking {
  id: string; userId: string; offerId: string; slotId: string | null; packageId: string | null; title: string;
  priceCents: number; status: BookingStatus; studentNote: string; adminMessage: string; createdAt: number;
  decidedAt: number | null; payDeadline: number | null; paidAt: number | null; cancelledAt: number | null;
  cancelledBy: string | null; refundCents: number; provider: string | null; providerRef: string | null;
  providerPayment: string | null; termsAt: number | null; reminded: boolean;
  kind: string | null; minutes: number | null; meetingPoint: string;
  /** Mit Guthaben verrechnet / bei Absage einbehalten */
  creditCents: number; chargeCents: number;
  // aus Join
  startsAt?: number | null; endsAt?: number | null; userName?: string; userEmail?: string; userPhone?: string | null;
}
export interface Settings { payWindowMin: number; freeCancelHours: number; minLeadHours: number; maxOpenRequests: number; cancelCutoffHour: number; lateChargePct: number; noShowChargePct: number }
export interface Template { id: string; kind: TemplateKind; label: string; body: string; sort: number }

export class BookingError extends Error {}

const DEFAULTS: Settings = { payWindowMin: 30, freeCancelHours: 24, minLeadHours: 12, maxOpenRequests: 5, cancelCutoffHour: 21, lateChargePct: 70, noShowChargePct: 75 };
const SETTING_KEYS: Record<keyof Settings, string> = {
  payWindowMin: "pay_window_min", freeCancelHours: "free_cancel_hours", minLeadHours: "min_lead_hours", maxOpenRequests: "max_open_requests",
  cancelCutoffHour: "cancel_cutoff_hour", lateChargePct: "late_charge_pct", noShowChargePct: "no_show_charge_pct",
};
export const SETTING_LIMITS: Record<keyof Settings, [number, number]> = {
  payWindowMin: [10, 24 * 60], freeCancelHours: [0, 14 * 24], minLeadHours: [0, 14 * 24], maxOpenRequests: [1, 50],
  cancelCutoffHour: [12, 24], lateChargePct: [0, 100], noShowChargePct: [0, 100],
};

// ---------- Mapping ----------------------------------------------------------

type Row = Record<string, unknown>;
const mapOffer = (r: Row): Offer => ({
  id: r.id as string, kind: r.kind as OfferKind, title: r.title as string, description: r.description as string,
  durationMin: r.duration_min as number, priceCents: r.price_cents as number, needsApproval: !!r.needs_approval,
  active: !!r.active, sort: r.sort as number,
});
const mapSlot = (r: Row): Slot => ({
  id: r.id as string, offerId: r.offer_id as string, startsAt: r.starts_at as number, endsAt: r.ends_at as number,
  status: r.status as SlotStatus, note: r.note as string,
});
const mapBooking = (r: Row): Booking => ({
  id: r.id as string, userId: r.user_id as string, offerId: r.offer_id as string, slotId: (r.slot_id as string) ?? null,
  packageId: (r.package_id as string) ?? null, title: r.title as string, priceCents: r.price_cents as number,
  status: r.status as BookingStatus, studentNote: r.student_note as string, adminMessage: r.admin_message as string,
  createdAt: r.created_at as number, decidedAt: (r.decided_at as number) ?? null, payDeadline: (r.pay_deadline as number) ?? null,
  paidAt: (r.paid_at as number) ?? null, cancelledAt: (r.cancelled_at as number) ?? null, cancelledBy: (r.cancelled_by as string) ?? null,
  refundCents: r.refund_cents as number, provider: (r.provider as string) ?? null, providerRef: (r.provider_ref as string) ?? null,
  providerPayment: (r.provider_payment as string) ?? null, termsAt: (r.terms_at as number) ?? null, reminded: !!r.reminded,
  kind: (r.kind as string) ?? null, minutes: (r.minutes as number) ?? null, meetingPoint: (r.meeting_point as string) ?? "",
  creditCents: (r.credit_cents as number) ?? 0, chargeCents: (r.charge_cents as number) ?? 0,
  startsAt: (r.starts_at as number) ?? null, endsAt: (r.ends_at as number) ?? null,
  userName: r.user_name as string | undefined, userEmail: r.user_email as string | undefined, userPhone: (r.user_phone as string) ?? null,
});

const BOOKING_SELECT = `
  SELECT b.*, s.starts_at, s.ends_at, u.name AS user_name, u.email AS user_email, u.phone AS user_phone
  FROM bookings b
  LEFT JOIN slots s ON s.id = b.slot_id
  JOIN users u ON u.id = b.user_id`;

// ---------- Einstellungen -----------------------------------------------------

export function getSettings(db: Database.Database): Settings {
  const rows = db.prepare(`SELECT key, value FROM settings`).all() as Array<{ key: string; value: string }>;
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const out = { ...DEFAULTS };
  for (const k of Object.keys(SETTING_KEYS) as Array<keyof Settings>) {
    const n = Number(map.get(SETTING_KEYS[k]));
    if (map.has(SETTING_KEYS[k]) && Number.isFinite(n)) out[k] = n;
  }
  return out;
}

export function saveSettings(db: Database.Database, s: Partial<Settings>): void {
  const up = db.prepare(`INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`);
  for (const k of Object.keys(s) as Array<keyof Settings>) {
    const v = s[k];
    if (v === undefined || !Number.isFinite(v)) continue;
    const [lo, hi] = SETTING_LIMITS[k];
    up.run(SETTING_KEYS[k], String(Math.min(hi, Math.max(lo, Math.round(v)))));
  }
}

// ---------- Angebote -----------------------------------------------------------

export function listOffers(db: Database.Database, opts: { bookableOnly?: boolean } = {}): Offer[] {
  const rows = db.prepare(`SELECT * FROM offers ORDER BY sort, created_at`).all() as Row[];
  const all = rows.map(mapOffer);
  return opts.bookableOnly ? all.filter(isBookable) : all;
}

/** Buchbar = aktiv und mit Preis (ohne Preis würde man sonst kostenlos buchen). */
export function isBookable(o: Offer): boolean {
  return o.active && o.priceCents > 0;
}

export function getOffer(db: Database.Database, id: string): Offer | undefined {
  const r = db.prepare(`SELECT * FROM offers WHERE id = ?`).get(id) as Row | undefined;
  return r ? mapOffer(r) : undefined;
}

export function saveOffer(
  db: Database.Database,
  o: { id?: string; kind: OfferKind; title: string; description: string; durationMin: number; priceCents: number; needsApproval: boolean; active: boolean },
): Offer {
  const title = o.title.trim().slice(0, 80);
  if (!title) throw new BookingError("Bitte einen Namen eingeben.");
  if (!Number.isInteger(o.priceCents) || o.priceCents < 0 || o.priceCents > 1_000_000) throw new BookingError("Preis ungültig.");
  if (o.kind === "slot" && (!Number.isInteger(o.durationMin) || o.durationMin < 15 || o.durationMin > 600)) {
    throw new BookingError("Dauer bitte zwischen 15 und 600 Minuten.");
  }
  if (o.id) {
    const existing = getOffer(db, o.id);
    if (!existing) throw new BookingError("Angebot nicht gefunden.");
    db.prepare(
      `UPDATE offers SET title=?, description=?, duration_min=?, price_cents=?, needs_approval=?, active=? WHERE id=?`,
    ).run(title, o.description.trim().slice(0, 400), existing.kind === "slot" ? o.durationMin : 0, o.priceCents,
      existing.kind === "slot" ? 1 : o.needsApproval ? 1 : 0, o.active ? 1 : 0, o.id);
    return getOffer(db, o.id)!;
  }
  if (o.kind === "language") throw new BookingError("Das Sprachpaket gibt es schon.");
  const id = randomUUID();
  const sort = (db.prepare(`SELECT COALESCE(MAX(sort),0)+1 AS n FROM offers`).get() as { n: number }).n;
  db.prepare(
    `INSERT INTO offers (id,kind,title,description,duration_min,price_cents,needs_approval,active,sort,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)`,
  ).run(id, o.kind, title, o.description.trim().slice(0, 400), o.kind === "slot" ? o.durationMin : 0, o.priceCents,
    o.kind === "slot" ? 1 : o.needsApproval ? 1 : 0, o.active ? 1 : 0, sort, Date.now());
  return getOffer(db, id)!;
}

// ---------- Termine freigeben -----------------------------------------------

export interface CreateSlotsResult { created: Slot[]; skipped: number[] }

/** Termine anlegen; überschneidet sich einer mit einem bestehenden Termin, wird er übersprungen. */
export function createSlots(db: Database.Database, offerId: string, starts: number[], now = Date.now()): CreateSlotsResult {
  const offer = getOffer(db, offerId);
  if (!offer || offer.kind !== "slot") throw new BookingError("Bitte eine Fahrstunden-Art wählen.");
  if (starts.length > 200) throw new BookingError("Höchstens 200 Termine auf einmal.");
  const overlap = db.prepare(`SELECT 1 FROM slots WHERE status != 'closed' AND starts_at < ? AND ends_at > ? LIMIT 1`);
  const ins = db.prepare(`INSERT INTO slots (id,offer_id,starts_at,ends_at,status,note,created_at) VALUES (?,?,?,?,'open','',?)`);
  const created: Slot[] = [];
  const skipped: number[] = [];
  db.transaction(() => {
    for (const s of [...starts].sort((a, b) => a - b)) {
      const e = s + offer.durationMin * 60_000;
      if (!Number.isFinite(s) || s < now || overlap.get(e, s)) { skipped.push(s); continue; }
      const id = randomUUID();
      ins.run(id, offerId, s, e, now);
      created.push({ id, offerId, startsAt: s, endsAt: e, status: "open", note: "" });
    }
  })();
  return { created, skipped };
}

export function getSlot(db: Database.Database, id: string): Slot | undefined {
  const r = db.prepare(`SELECT * FROM slots WHERE id = ?`).get(id) as Row | undefined;
  return r ? mapSlot(r) : undefined;
}

export interface SlotWithBookings extends Slot { offer: Offer; bookings: Booking[] }

/** Für den Kalender der Fahrschule: alle Termine im Zeitraum mit ihren Anfragen/Buchungen. */
export function listSlotsBetween(db: Database.Database, from: number, to: number): SlotWithBookings[] {
  const slots = (db.prepare(`SELECT * FROM slots WHERE starts_at >= ? AND starts_at < ? AND status != 'closed' ORDER BY starts_at`)
    .all(from, to) as Row[]).map(mapSlot);
  if (!slots.length) return [];
  const offers = new Map(listOffers(db).map((o) => [o.id, o]));
  const bookings = (db.prepare(`${BOOKING_SELECT} WHERE s.starts_at >= ? AND s.starts_at < ? ORDER BY b.created_at`).all(from, to) as Row[]).map(mapBooking);
  return slots.map((s) => ({ ...s, offer: offers.get(s.offerId)!, bookings: bookings.filter((b) => b.slotId === s.id) }));
}

export interface OpenSlot extends Slot { offer: Offer; myBooking: Booking | null }

/** Für Schüler: freie Termine (Zukunft, Vorlauf beachtet, Angebot buchbar). */
export function listOpenSlots(db: Database.Database, userId: string, from: number, to: number, now = Date.now()): OpenSlot[] {
  const { minLeadHours } = getSettings(db);
  const earliest = Math.max(from, now + minLeadHours * 3_600_000);
  const offers = new Map(listOffers(db).map((o) => [o.id, o]));
  const slots = (db.prepare(`SELECT * FROM slots WHERE status = 'open' AND starts_at >= ? AND starts_at < ? ORDER BY starts_at`)
    .all(earliest, to) as Row[]).map(mapSlot);
  const mine = (db.prepare(`${BOOKING_SELECT} WHERE b.user_id = ? AND b.status = 'requested'`).all(userId) as Row[]).map(mapBooking);
  return slots
    .map((s) => ({ ...s, offer: offers.get(s.offerId)!, myBooking: mine.find((b) => b.slotId === s.id) ?? null }))
    .filter((s) => s.offer && isBookable(s.offer));
}

/** Freien Termin löschen. Offene Anfragen dafür werden abgelehnt (Rückgabe für Benachrichtigung). */
export function closeSlot(db: Database.Database, slotId: string, message: string): Booking[] {
  return db.transaction(() => {
    const slot = getSlot(db, slotId);
    if (!slot) throw new BookingError("Termin nicht gefunden.");
    if (slot.status !== "open") throw new BookingError("Dieser Termin ist schon vergeben. Bitte zuerst die Buchung absagen.");
    db.prepare(`UPDATE slots SET status = 'closed' WHERE id = ?`).run(slotId);
    return declineOthers(db, slotId, null, message);
  })();
}

// ---------- Buchungen ------------------------------------------------------------

export function getBooking(db: Database.Database, id: string): Booking | undefined {
  const r = db.prepare(`${BOOKING_SELECT} WHERE b.id = ?`).get(id) as Row | undefined;
  return r ? mapBooking(r) : undefined;
}

export function listBookingsForUser(db: Database.Database, userId: string): Booking[] {
  return (db.prepare(`${BOOKING_SELECT} WHERE b.user_id = ? ORDER BY b.created_at DESC LIMIT 200`).all(userId) as Row[]).map(mapBooking);
}

export function listBookingsByStatus(db: Database.Database, statuses: BookingStatus[]): Booking[] {
  const q = statuses.map(() => "?").join(",");
  return (db.prepare(`${BOOKING_SELECT} WHERE b.status IN (${q}) ORDER BY COALESCE(s.starts_at, b.created_at)`).all(...statuses) as Row[]).map(mapBooking);
}

/** Bezahlte Buchungen (auch Produkte) der letzten Zeit – für die Übersicht. */
export function listRecentPaid(db: Database.Database, limit = 30): Booking[] {
  return (db.prepare(`${BOOKING_SELECT} WHERE b.status = 'paid' ORDER BY b.paid_at DESC LIMIT ?`).all(limit) as Row[]).map(mapBooking);
}

function insertBooking(db: Database.Database, b: Omit<Booking, "decidedAt" | "paidAt" | "cancelledAt" | "cancelledBy" | "refundCents" | "provider" | "providerRef" | "providerPayment" | "termsAt" | "reminded" | "adminMessage" | "kind" | "minutes" | "meetingPoint" | "creditCents" | "chargeCents">): void {
  db.prepare(
    `INSERT INTO bookings (id,user_id,offer_id,slot_id,package_id,title,price_cents,status,student_note,created_at,pay_deadline)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
  ).run(b.id, b.userId, b.offerId, b.slotId, b.packageId, b.title, b.priceCents, b.status, b.studentNote, b.createdAt, b.payDeadline);
}

function openRequestCount(db: Database.Database, userId: string): number {
  return (db.prepare(`SELECT COUNT(*) AS n FROM bookings WHERE user_id = ? AND status IN ('requested','awaiting_payment') AND slot_id IS NOT NULL`)
    .get(userId) as { n: number }).n;
}

/** Schüler fragt einen freien Termin an. */
export function requestSlot(db: Database.Database, userId: string, slotId: string, note: string, now = Date.now()): Booking {
  return db.transaction(() => {
    const slot = getSlot(db, slotId);
    if (!slot || slot.status !== "open") throw new BookingError("Dieser Termin ist leider nicht mehr frei.");
    const s = getSettings(db);
    if (slot.startsAt < now + s.minLeadHours * 3_600_000) throw new BookingError("Dieser Termin ist zu kurzfristig für eine Online-Anfrage.");
    const offer = getOffer(db, slot.offerId);
    if (!offer || !isBookable(offer)) throw new BookingError("Diese Fahrstunden-Art ist gerade nicht buchbar.");
    const dup = db.prepare(`SELECT 1 FROM bookings WHERE user_id = ? AND slot_id = ? AND status IN ('requested','awaiting_payment','paid')`).get(userId, slotId);
    if (dup) throw new BookingError("Du hast diesen Termin schon angefragt.");
    if (openRequestCount(db, userId) >= s.maxOpenRequests) {
      throw new BookingError(`Du hast schon ${s.maxOpenRequests} offene Anfragen. Bitte warte auf die Antwort der Fahrschule.`);
    }
    const id = randomUUID();
    insertBooking(db, {
      id, userId, offerId: offer.id, slotId, packageId: null, title: offer.title, priceCents: offer.priceCents,
      status: "requested", studentNote: note.trim().slice(0, 300), createdAt: now, payDeadline: null,
    });
    return getBooking(db, id)!;
  })();
}

/** Kauf ohne Termin (Grundbetrag, Sprachpaket …). Ohne Freigabe sofort zahlbar. */
export function orderProduct(db: Database.Database, userId: string, offerId: string, opts: { packageId?: string } = {}, now = Date.now()): Booking {
  return db.transaction(() => {
    const offer = getOffer(db, offerId);
    if (!offer || offer.kind === "slot" || !isBookable(offer)) throw new BookingError("Dieses Angebot ist gerade nicht buchbar.");
    // Eine noch offene Bestellung desselben Angebots wiederverwenden (z. B. Zahlung abgebrochen).
    const open = db.prepare(`SELECT id FROM bookings WHERE user_id = ? AND offer_id = ? AND status IN ('requested','awaiting_payment')`).get(userId, offerId) as { id: string } | undefined;
    if (open) {
      const b = getBooking(db, open.id)!;
      if (b.status === "awaiting_payment") db.prepare(`UPDATE bookings SET pay_deadline = ? WHERE id = ?`).run(now + getSettings(db).payWindowMin * 60_000, b.id);
      return getBooking(db, b.id)!;
    }
    const id = randomUUID();
    const direct = !offer.needsApproval;
    insertBooking(db, {
      id, userId, offerId, slotId: null, packageId: opts.packageId ?? null, title: offer.title, priceCents: offer.priceCents,
      status: direct ? "awaiting_payment" : "requested", studentNote: "", createdAt: now,
      payDeadline: direct ? now + getSettings(db).payWindowMin * 60_000 : null,
    });
    return getBooking(db, id)!;
  })();
}

function declineOthers(db: Database.Database, slotId: string, exceptId: string | null, message: string, now = Date.now()): Booking[] {
  const others = (db.prepare(`${BOOKING_SELECT} WHERE b.slot_id = ? AND b.status = 'requested' AND b.id != ?`).all(slotId, exceptId ?? "") as Row[]).map(mapBooking);
  const upd = db.prepare(`UPDATE bookings SET status = 'declined', admin_message = ?, decided_at = ? WHERE id = ?`);
  for (const o of others) upd.run(message, now, o.id);
  return others.map((o) => ({ ...o, status: "declined" as const, adminMessage: message }));
}

export interface ConfirmResult { booking: Booking; autoDeclined: Booking[] }

/** Fahrschule bestätigt eine Anfrage → Schüler hat X Minuten zum Bezahlen. */
export function confirmBooking(db: Database.Database, bookingId: string, message: string, autoDeclineMessage: string, now = Date.now()): ConfirmResult {
  return db.transaction(() => {
    const b = getBooking(db, bookingId);
    if (!b || b.status !== "requested") throw new BookingError("Diese Anfrage ist nicht mehr offen.");
    const deadline = now + getSettings(db).payWindowMin * 60_000;
    let autoDeclined: Booking[] = [];
    if (b.slotId) {
      const slot = getSlot(db, b.slotId);
      // Alte Termine: "open"; neue Kalender-Buchung: Zeit ist für diese Anfrage schon reserviert.
      if (!slot || (slot.status !== "open" && !(slot.status === "reserved" && b.kind))) throw new BookingError("Der Termin ist nicht mehr frei.");
      db.prepare(`UPDATE slots SET status = 'reserved' WHERE id = ?`).run(b.slotId);
      autoDeclined = declineOthers(db, b.slotId, b.id, autoDeclineMessage, now);
    }
    db.prepare(`UPDATE bookings SET status = 'awaiting_payment', admin_message = ?, decided_at = ?, pay_deadline = ?, reminded = 0 WHERE id = ?`)
      .run(message.trim().slice(0, 1000), now, deadline, b.id);
    return { booking: getBooking(db, b.id)!, autoDeclined };
  })();
}

export function declineBooking(db: Database.Database, bookingId: string, message: string, now = Date.now()): Booking {
  const b = getBooking(db, bookingId);
  if (!b || b.status !== "requested") throw new BookingError("Diese Anfrage ist nicht mehr offen.");
  db.prepare(`UPDATE bookings SET status = 'declined', admin_message = ?, decided_at = ? WHERE id = ?`).run(message.trim().slice(0, 1000), now, b.id);
  if (b.slotId && b.kind) db.prepare(`UPDATE slots SET status = 'closed' WHERE id = ?`).run(b.slotId); // Zeit wird wieder frei
  return getBooking(db, b.id)!;
}

/** Zahlungsfrist abgelaufen → Termin wird wieder frei. */
export function expireDue(db: Database.Database, now = Date.now()): Booking[] {
  return db.transaction(() => {
    const due = (db.prepare(`${BOOKING_SELECT} WHERE b.status = 'awaiting_payment' AND b.pay_deadline < ?`).all(now) as Row[]).map(mapBooking);
    for (const b of due) {
      db.prepare(`UPDATE bookings SET status = 'expired' WHERE id = ?`).run(b.id);
      if (b.slotId) db.prepare(`UPDATE slots SET status = ? WHERE id = ? AND status = 'reserved'`).run(b.kind ? "closed" : "open", b.slotId);
    }
    return due.map((b) => ({ ...b, status: "expired" as const }));
  })();
}

/** Buchungen, deren Frist bald endet und die noch nicht erinnert wurden. */
export function dueForReminder(db: Database.Database, withinMs: number, now = Date.now()): Booking[] {
  const list = (db.prepare(`${BOOKING_SELECT} WHERE b.status = 'awaiting_payment' AND b.reminded = 0 AND b.slot_id IS NOT NULL AND b.pay_deadline BETWEEN ? AND ?`)
    .all(now, now + withinMs) as Row[]).map(mapBooking);
  const upd = db.prepare(`UPDATE bookings SET reminded = 1 WHERE id = ?`);
  for (const b of list) upd.run(b.id);
  return list;
}

export function setPaymentRef(db: Database.Database, bookingId: string, provider: string, ref: string, termsAt: number): void {
  db.prepare(`UPDATE bookings SET provider = ?, provider_ref = ?, terms_at = COALESCE(terms_at, ?) WHERE id = ?`).run(provider, ref, termsAt, bookingId);
}

export type MarkPaidResult =
  | { ok: true; booking: Booking; already: boolean }
  | { ok: false; reason: "conflict" | "not_found" | "amount"; booking?: Booking };

/**
 * Zahlung eingegangen. Kommt sie nach Ablauf der Frist und der Termin ist inzwischen
 * an jemand anderen gegangen → "conflict" (Geld wird automatisch zurückgezahlt).
 */
export function markPaid(
  db: Database.Database, bookingId: string,
  p: { provider: string; paymentRef: string; amountCents: number | null },
  now = Date.now(),
): MarkPaidResult {
  return db.transaction((): MarkPaidResult => {
    const b = getBooking(db, bookingId);
    if (!b) return { ok: false, reason: "not_found" };
    if (b.status === "paid") return { ok: true, booking: b, already: true };
    // Erwartet wird der Preis abzüglich des verrechneten Guthabens.
    if (p.amountCents !== null && p.amountCents !== b.priceCents - b.creditCents) return { ok: false, reason: "amount", booking: b };
    if (b.status !== "awaiting_payment" && b.status !== "expired") return { ok: false, reason: "conflict", booking: b };
    if (b.slotId) {
      const slot = getSlot(db, b.slotId);
      const takenByOther = db.prepare(`SELECT 1 FROM bookings WHERE slot_id = ? AND id != ? AND status IN ('awaiting_payment','paid')`).get(b.slotId, b.id);
      let slotOk = !!slot && slot.status !== "closed" && slot.status !== "booked" && !takenByOther;
      if (slot && slot.status === "closed" && b.kind && !takenByOther) {
        // Frist war abgelaufen: Zahlung trotzdem annehmen, wenn die Zeit noch frei ist.
        const clash = db.prepare(`SELECT 1 FROM slots WHERE id != ? AND status IN ('reserved','booked') AND starts_at < ? AND ends_at > ?`).get(slot.id, slot.endsAt, slot.startsAt)
          || db.prepare(`SELECT 1 FROM blocks WHERE starts_at < ? AND ends_at > ?`).get(slot.endsAt, slot.startsAt);
        slotOk = !clash;
      }
      if (!slotOk) return { ok: false, reason: "conflict", booking: b };
      db.prepare(`UPDATE slots SET status = 'booked' WHERE id = ?`).run(b.slotId);
      declineOthers(db, b.slotId, b.id, "Dieser Termin ist leider schon vergeben.", now);
    }
    db.prepare(`UPDATE bookings SET status = 'paid', paid_at = ?, provider = ?, provider_payment = ? WHERE id = ?`)
      .run(now, p.provider, p.paymentRef, b.id);
    if (b.packageId) {
      db.prepare(`UPDATE language_packages SET status = 'paid', paid_at = ? WHERE id = ? AND status != 'cancelled'`).run(new Date(now).toISOString(), b.packageId);
    }
    return { ok: true, booking: getBooking(db, b.id)!, already: false };
  })();
}

export interface CancelResult { booking: Booking; refundCents: number }

/** Schüler sagt ab: Anfrage zurückziehen, oder bezahlte Stunde bis X Stunden vorher (Geld zurück). */
export function cancelByStudent(db: Database.Database, userId: string, bookingId: string, now = Date.now()): CancelResult {
  return db.transaction(() => {
    const b = getBooking(db, bookingId);
    if (!b || b.userId !== userId) throw new BookingError("Buchung nicht gefunden.");
    if (b.status === "requested" || b.status === "awaiting_payment") {
      db.prepare(`UPDATE bookings SET status = 'withdrawn', cancelled_at = ?, cancelled_by = 'student' WHERE id = ?`).run(now, b.id);
      if (b.slotId && (b.status === "awaiting_payment" || b.kind)) db.prepare(`UPDATE slots SET status = ? WHERE id = ? AND status = 'reserved'`).run(b.kind ? "closed" : "open", b.slotId);
      return { booking: getBooking(db, b.id)!, refundCents: 0 };
    }
    if (b.status !== "paid" || !b.slotId || !b.startsAt) throw new BookingError("Diese Buchung kann online nicht abgesagt werden. Bitte melde dich bei der Fahrschule.");
    const { freeCancelHours } = getSettings(db);
    if (b.startsAt - now < freeCancelHours * 3_600_000) {
      throw new BookingError(`Eine kostenlose Absage ist nur bis ${freeCancelHours} Stunden vor dem Termin möglich. Bitte melde dich bei der Fahrschule.`);
    }
    db.prepare(`UPDATE bookings SET status = 'cancelled', cancelled_at = ?, cancelled_by = 'student', refund_cents = ? WHERE id = ?`).run(now, b.priceCents, b.id);
    db.prepare(`UPDATE slots SET status = ? WHERE id = ?`).run(b.kind ? "closed" : "open", b.slotId);
    return { booking: getBooking(db, b.id)!, refundCents: b.priceCents };
  })();
}

/** Fahrschule sagt ab (auch bezahlte Termine). Termin optional wieder freigeben. */
export function cancelByAdmin(
  db: Database.Database, bookingId: string,
  o: { message: string; refund: boolean; reopenSlot: boolean },
  now = Date.now(),
): CancelResult {
  return db.transaction(() => {
    const b = getBooking(db, bookingId);
    if (!b || !["requested", "awaiting_payment", "paid"].includes(b.status)) throw new BookingError("Diese Buchung ist nicht mehr aktiv.");
    const refundCents = b.status === "paid" && o.refund ? b.priceCents : 0;
    db.prepare(`UPDATE bookings SET status = 'cancelled', admin_message = ?, cancelled_at = ?, cancelled_by = 'school', refund_cents = ? WHERE id = ?`)
      .run(o.message.trim().slice(0, 1000), now, refundCents, b.id);
    if (b.slotId && b.kind) {
      // Kalender-Fahrt: Zeit wird frei – außer die Fahrschule will sie nicht wieder anbieten (dann Sperrzeit).
      const slot = getSlot(db, b.slotId);
      db.prepare(`UPDATE slots SET status = 'closed' WHERE id = ?`).run(b.slotId);
      if (!o.reopenSlot && slot) {
        const teacher = db.prepare(`SELECT id FROM users WHERE role = 'teacher' ORDER BY created_at LIMIT 1`).get() as { id: string } | undefined;
        if (teacher) db.prepare(`INSERT INTO blocks (id, teacher_id, starts_at, ends_at, note, created_at) VALUES (?,?,?,?,?,?)`)
          .run(randomUUID(), teacher.id, slot.startsAt, slot.endsAt, "nach Absage gesperrt", now);
      }
    } else if (b.slotId && b.status !== "requested") {
      db.prepare(`UPDATE slots SET status = ? WHERE id = ?`).run(o.reopenSlot ? "open" : "closed", b.slotId);
    }
    return { booking: getBooking(db, b.id)!, refundCents };
  })();
}

/** Rückzahlung fehlgeschlagen → in der Buchung vermerken, damit die Fahrschule es sieht. */
export function noteRefundProblem(db: Database.Database, bookingId: string, text: string): void {
  db.prepare(`UPDATE bookings SET admin_message = admin_message || ? WHERE id = ?`).run(`\n[Rückzahlung: ${text}]`, bookingId);
}

// ---------- Nachrichten an Schüler -----------------------------------------------

export interface Notification { id: string; userId: string; bookingId: string | null; title: string; body: string; createdAt: number; readAt: number | null }

export function addNotification(db: Database.Database, userId: string, bookingId: string | null, title: string, body: string, now = Date.now()): Notification {
  const n = { id: randomUUID(), userId, bookingId, title, body, createdAt: now, readAt: null };
  db.prepare(`INSERT INTO notifications (id,user_id,booking_id,title,body,created_at) VALUES (?,?,?,?,?,?)`).run(n.id, userId, bookingId, title, body, now);
  return n;
}

export function listNotifications(db: Database.Database, userId: string, limit = 20): Notification[] {
  return (db.prepare(`SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`).all(userId, limit) as Row[]).map((r) => ({
    id: r.id as string, userId: r.user_id as string, bookingId: (r.booking_id as string) ?? null, title: r.title as string,
    body: r.body as string, createdAt: r.created_at as number, readAt: (r.read_at as number) ?? null,
  }));
}

export function markNotificationsRead(db: Database.Database, userId: string, now = Date.now()): void {
  db.prepare(`UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL`).run(now, userId);
}

// ---------- Textvorlagen ---------------------------------------------------------

export function listTemplates(db: Database.Database, kind?: TemplateKind): Template[] {
  const rows = (kind
    ? db.prepare(`SELECT * FROM templates WHERE kind = ? ORDER BY sort`).all(kind)
    : db.prepare(`SELECT * FROM templates ORDER BY kind, sort`).all()) as Row[];
  return rows.map((r) => ({ id: r.id as string, kind: r.kind as TemplateKind, label: r.label as string, body: r.body as string, sort: r.sort as number }));
}

export function saveTemplate(db: Database.Database, t: { id?: string; kind: TemplateKind; label: string; body: string }): void {
  const label = t.label.trim().slice(0, 40), body = t.body.trim().slice(0, 1000);
  if (!label || !body) throw new BookingError("Bitte Name und Text ausfüllen.");
  if (t.id) db.prepare(`UPDATE templates SET label = ?, body = ? WHERE id = ?`).run(label, body, t.id);
  else {
    const sort = (db.prepare(`SELECT COALESCE(MAX(sort),0)+1 AS n FROM templates`).get() as { n: number }).n;
    db.prepare(`INSERT INTO templates (id,kind,label,body,sort) VALUES (?,?,?,?,?)`).run(randomUUID(), t.kind, label, body, sort);
  }
}

export function deleteTemplate(db: Database.Database, id: string): void {
  db.prepare(`DELETE FROM templates WHERE id = ?`).run(id);
}

/** Webhook-Ereignis nur einmal verarbeiten. */
export function firstTimeEvent(db: Database.Database, id: string): boolean {
  return db.prepare(`INSERT OR IGNORE INTO payment_events (id, at) VALUES (?, ?)`).run(id, Date.now()).changes === 1;
}
