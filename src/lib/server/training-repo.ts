import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import {
  computeTraining, DRIVE_KINDS, MIN_REPEAT, TRAINING_CLASSES,
  type DriveKind, type DriveRecord, type RecordStatus, type TrainingClass, type TrainingProfile, type TrainingState,
} from "../training";

/** Ausbildungsstand eines Schülers in der Datenbank. */
export interface ProfileRow extends TrainingProfile {
  userId: string;
  sehtestAt: number | null; ersteHilfeAt: number | null; antragAt: number | null;
  manualApproval: boolean; blocked: boolean; maxPerWeek: number; teacherNote: string;
  /** Grundbetrag schon anders geregelt (vor der App bezahlt / erlassen) */
  grundWaived: boolean;
}
export interface StoredRecord extends DriveRecord { id: string; userId: string; at: number; source: string; note: string; bookingId: string | null }

type Row = Record<string, unknown>;
const n = (v: unknown) => (v === null || v === undefined ? null : Number(v));

function mapProfile(r: Row): ProfileRow {
  return {
    userId: r.user_id as string, licenseClass: r.license_class as TrainingClass, practiceTarget: n(r.practice_target),
    repeatTarget: Number(r.repeat_target), extraManual: Number(r.extra_manual), testfahrtPassedAt: n(r.testfahrt_passed_at),
    examReadyAt: n(r.exam_ready_at), theoryPassedAt: n(r.theory_passed_at), pruefauftragAt: n(r.pruefauftrag_at),
    sehtestAt: n(r.sehtest_at), ersteHilfeAt: n(r.erste_hilfe_at), antragAt: n(r.antrag_at),
    manualApproval: !!r.manual_approval, blocked: !!r.blocked, maxPerWeek: Number(r.max_per_week), teacherNote: r.teacher_note as string,
    grundWaived: !!r.grund_waived, passedAt: n(r.passed_at),
  };
}

export function isTrainingClass(s: unknown): s is TrainingClass {
  return typeof s === "string" && (TRAINING_CLASSES as string[]).includes(s);
}
export function isDriveKind(s: unknown): s is DriveKind {
  return typeof s === "string" && (DRIVE_KINDS as string[]).includes(s);
}

export function getProfile(db: Database.Database, userId: string): ProfileRow | null {
  const r = db.prepare(`SELECT * FROM training_profiles WHERE user_id = ?`).get(userId) as Row | undefined;
  return r ? mapProfile(r) : null;
}

export function ensureProfile(db: Database.Database, userId: string, licenseClass: TrainingClass): ProfileRow {
  db.prepare(`INSERT OR IGNORE INTO training_profiles (user_id, license_class, repeat_target, updated_at) VALUES (?,?,?,?)`)
    .run(userId, licenseClass, MIN_REPEAT, Date.now());
  return getProfile(db, userId)!;
}

/** Felder, die der Fahrlehrer ändern darf (nur die übergebenen werden geändert). */
export interface ProfilePatch {
  licenseClass?: TrainingClass; practiceTarget?: number | null; repeatTarget?: number; extraManual?: number;
  testfahrtPassedAt?: number | null; examReadyAt?: number | null; theoryPassedAt?: number | null; pruefauftragAt?: number | null;
  sehtestAt?: number | null; ersteHilfeAt?: number | null; antragAt?: number | null;
  manualApproval?: boolean; blocked?: boolean; maxPerWeek?: number; teacherNote?: string;
  grundWaived?: boolean; passedAt?: number | null;
}
const COLS: Record<keyof ProfilePatch, string> = {
  licenseClass: "license_class", practiceTarget: "practice_target", repeatTarget: "repeat_target", extraManual: "extra_manual",
  testfahrtPassedAt: "testfahrt_passed_at", examReadyAt: "exam_ready_at", theoryPassedAt: "theory_passed_at", pruefauftragAt: "pruefauftrag_at",
  sehtestAt: "sehtest_at", ersteHilfeAt: "erste_hilfe_at", antragAt: "antrag_at",
  manualApproval: "manual_approval", blocked: "blocked", maxPerWeek: "max_per_week", teacherNote: "teacher_note",
  grundWaived: "grund_waived", passedAt: "passed_at",
};

export function updateProfile(db: Database.Database, userId: string, patch: ProfilePatch): ProfileRow {
  const p = { ...patch };
  if (p.licenseClass !== undefined && !isTrainingClass(p.licenseClass)) throw new Error("Klasse ungültig");
  if (p.repeatTarget !== undefined) p.repeatTarget = Math.min(40, Math.max(MIN_REPEAT, Math.round(p.repeatTarget)));
  if (p.practiceTarget !== undefined && p.practiceTarget !== null) p.practiceTarget = Math.min(200, Math.max(1, Math.round(p.practiceTarget)));
  if (p.extraManual !== undefined) p.extraManual = Math.min(40, Math.max(0, Math.round(p.extraManual)));
  if (p.maxPerWeek !== undefined) p.maxPerWeek = Math.min(14, Math.max(1, Math.round(p.maxPerWeek)));
  if (p.teacherNote !== undefined) p.teacherNote = p.teacherNote.slice(0, 2000);
  const keys = (Object.keys(p) as Array<keyof ProfilePatch>).filter((k) => p[k] !== undefined);
  if (keys.length) {
    const sql = `UPDATE training_profiles SET ${keys.map((k) => `${COLS[k]} = ?`).join(", ")}, updated_at = ? WHERE user_id = ?`;
    const vals = keys.map((k) => { const v = p[k]; return typeof v === "boolean" ? (v ? 1 : 0) : v; });
    db.prepare(sql).run(...vals, Date.now(), userId);
  }
  return getProfile(db, userId)!;
}

export function listRecords(db: Database.Database, userId: string): StoredRecord[] {
  return (db.prepare(`SELECT * FROM drive_records WHERE user_id = ? ORDER BY at DESC, created_at DESC`).all(userId) as Row[]).map((r) => ({
    id: r.id as string, userId: r.user_id as string, kind: r.kind as DriveKind, minutes: Number(r.minutes), status: r.status as RecordStatus,
    at: Number(r.at), source: r.source as string, note: r.note as string, bookingId: (r.booking_id as string) ?? null,
  }));
}

export function addRecord(db: Database.Database, r: { userId: string; kind: DriveKind; minutes: number; at: number; status: RecordStatus; note?: string; createdBy?: string; bookingId?: string; source?: string }): string {
  if (!isDriveKind(r.kind)) throw new Error("Art ungültig");
  if (!Number.isInteger(r.minutes) || r.minutes < 15 || r.minutes > 240 || r.minutes % 15) throw new Error("Bitte eine Dauer zwischen 15 und 240 Minuten.");
  if (!Number.isFinite(r.at)) throw new Error("Datum ungültig");
  const id = randomUUID();
  db.prepare(`INSERT INTO drive_records (id,user_id,kind,minutes,at,status,booking_id,source,note,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id, r.userId, r.kind, r.minutes, r.at, r.status, r.bookingId ?? null, r.source ?? "manual", (r.note ?? "").slice(0, 300), r.createdBy ?? null, Date.now());
  return id;
}

export function setRecordStatus(db: Database.Database, id: string, status: RecordStatus): void {
  db.prepare(`UPDATE drive_records SET status = ? WHERE id = ?`).run(status, id);
}

export function deleteRecord(db: Database.Database, id: string): void {
  db.prepare(`DELETE FROM drive_records WHERE id = ? AND source = 'manual'`).run(id);
}

/** Testfahrt 30 oder 45 Min (Einstellung der Fahrschule). */
export function testfahrtMinutes(db: Database.Database): 30 | 45 {
  const r = db.prepare(`SELECT value FROM settings WHERE key = 'testfahrt_minutes'`).get() as { value: string } | undefined;
  return r?.value === "45" ? 45 : 30;
}

/** Geplante Fahrten, deren Ende vorbei ist und die 24 Std. nicht beanstandet wurden → „gefahren“. */
export function autoCompletePast(db: Database.Database, now = Date.now()): number {
  return db.prepare(`UPDATE drive_records SET status = 'done' WHERE status = 'planned' AND at < ?`).run(now - 24 * 3_600_000).changes;
}

export function trainingStateFor(db: Database.Database, userId: string): { profile: ProfileRow; state: TrainingState; records: StoredRecord[] } | null {
  const profile = getProfile(db, userId);
  if (!profile) return null;
  const records = listRecords(db, userId);
  return { profile, records, state: computeTraining(profile, records, { testfahrtMinutes: testfahrtMinutes(db) }) };
}

/** Grundbetrag bezahlt (oder von der Fahrschule als „anders geregelt“ markiert)? */
export function grundbetragPaid(db: Database.Database, userId: string): boolean {
  const p = getProfile(db, userId);
  if (p?.grundWaived) return true;
  return !!db.prepare(`SELECT 1 FROM bookings WHERE user_id = ? AND offer_id = 'fee-grundbetrag' AND status = 'paid'`).get(userId);
}
