import type Database from "better-sqlite3";
import type { DriveKind } from "../training";

/**
 * Fahrt-Historie eines Schülers: gefahrene/ausgefallene Fahrten (drive_records) + kommende gebuchte Fahrten.
 * „Mit wem“ = die Lehrkraft. Heute gibt es nur eine – trägt sie eine Fahrt selbst ein, steht ihr Name dabei,
 * sonst die Hauptlehrkraft der Fahrschule.
 */
export interface DriveEntry {
  id: string; at: number; end: number; kind: DriveKind; minutes: number;
  status: "done" | "no_show" | "late" | "booked" | "open";
  teacher: string; meeting: string; note: string; source: string; recordId: string | null;
}

export function driveHistory(db: Database.Database, userId: string, now = Date.now()): { past: DriveEntry[]; upcoming: DriveEntry[] } {
  const main = (db.prepare(`SELECT name FROM users WHERE role = 'teacher' ORDER BY created_at LIMIT 1`).get() as { name: string } | undefined)?.name ?? "Fahrschule";
  const recs = db.prepare(`SELECT r.*, u.name AS tname, b.meeting_point FROM drive_records r
    LEFT JOIN users u ON u.id = r.created_by LEFT JOIN bookings b ON b.id = r.booking_id
    WHERE r.user_id = ? AND r.status != 'planned' ORDER BY r.at DESC`).all(userId) as Array<Record<string, unknown>>;
  const past: DriveEntry[] = recs.map((r) => ({
    id: r.id as string, recordId: r.id as string, at: Number(r.at), end: Number(r.at) + Number(r.minutes) * 60_000, kind: r.kind as DriveKind, minutes: Number(r.minutes),
    status: r.status as DriveEntry["status"], teacher: (r.tname as string) ?? main, meeting: (r.meeting_point as string) ?? "", note: (r.note as string) ?? "", source: r.source as string,
  }));
  const up = db.prepare(`SELECT b.id, b.kind, b.minutes, b.status, b.meeting_point, s.starts_at, s.ends_at FROM bookings b JOIN slots s ON s.id = b.slot_id
    WHERE b.user_id = ? AND b.kind IS NOT NULL AND b.status IN ('requested','awaiting_payment','paid') AND s.ends_at > ?
    AND NOT EXISTS (SELECT 1 FROM drive_records r WHERE r.booking_id = b.id) ORDER BY s.starts_at`).all(userId, now) as Array<Record<string, unknown>>;
  const upcoming: DriveEntry[] = up.map((r) => ({
    id: r.id as string, recordId: null, at: Number(r.starts_at), end: Number(r.starts_at) + Number(r.minutes) * 60_000, kind: r.kind as DriveKind, minutes: Number(r.minutes),
    status: r.status === "paid" ? "booked" : "open", teacher: main, meeting: (r.meeting_point as string) ?? "", note: "", source: "booking",
  }));
  return { past, upcoming };
}
