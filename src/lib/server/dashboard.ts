import type Database from "better-sqlite3";
import { addDays, berlinToMs, dayKey, mondayOf } from "../time";
import { workDaysOfWeek, workIntervals } from "../calendar";
import { computeTraining, type PhaseId } from "../training";
import { parseLines } from "./booking";
import { dayRanges, listBlocks, mainTeacherId, STRIKE_NOTE } from "./drive-booking";
import { getProfile, grundbetragPaid, listRecords, testfahrtMinutes } from "./training-repo";
import { creditBalance } from "./credit";
import { examMissing, listExams, type Exam } from "./exams";

/**
 * Zahlen und Listen für die Übersicht der Fahrschule (Startseite nach dem Login).
 * „Einnahmen“ = tatsächlich eingegangenes Geld (ohne verrechnetes Guthaben), nach Zahlungstag.
 * TÜV-Gebühren werden getrennt gezählt – das ist durchlaufendes Geld für den TÜV.
 */

export const IDLE_DAYS = 14;
const DAY = 86_400_000;

type Row = Record<string, unknown>;
export type Category = "fahrten" | "grundbetrag" | "pruefungen" | "sprachpaket" | "sonstiges";
export const CATEGORY_LABEL: Record<Category, string> = {
  fahrten: "Fahrstunden", grundbetrag: "Grundbeträge", pruefungen: "Prüfungen (Fahrschule)", sprachpaket: "Sprachpakete", sonstiges: "Sonstiges",
};

interface PaidRow { offer_id: string; price_cents: number; credit_cents: number; paid_at: number; exam_id: string | null; lines: string; starts_at: number | null }

function categorize(r: Pick<PaidRow, "offer_id" | "exam_id">): Category {
  if (r.exam_id) return "pruefungen";
  if (r.offer_id.startsWith("drive-")) return "fahrten";
  if (r.offer_id === "fee-grundbetrag") return "grundbetrag";
  if (r.offer_id === "sprachpaket") return "sprachpaket";
  return "sonstiges";
}

/** Eingegangenes Geld einer Buchung, aufgeteilt in Fahrschule und TÜV. */
function split(r: PaidRow): { school: number; tuev: number } {
  const money = Math.max(0, r.price_cents - (r.credit_cents ?? 0));
  const tuevLines = parseLines(r.lines).filter((l) => l.part === "tuev").reduce((a, l) => a + l.cents, 0);
  const tuev = Math.min(money, tuevLines);
  return { school: money - tuev, tuev };
}

export interface WeekBar { label: string; from: number; school: number; tuev: number; future: boolean }

export interface Dashboard {
  kpi: {
    students: number; newStudents: number;
    revenueMonth: number; revenuePrev: number; tuevMonth: number;
    openPayments: number; openCount: number;
    utilization: number; bookedMin: number; workMin: number;
  };
  byCategory: Array<{ cat: Category; cents: number }>;
  weeks: WeekBar[];
  today: Array<{ start: number; end: number; title: string; userId: string; userName: string; status: string; meeting: string; now: boolean; private?: boolean }>;
  todo: Array<{ kind: string; text: string; href: string; userName?: string }>;
  calls: Array<{ userId: string; name: string; phone: string | null; reason: string; score: number }>;
  waitlist: Array<{ userId: string; name: string; day: string; fromMin: number; toMin: number }>;
  exams: Array<Exam & { name: string }>;
  phases: Array<{ id: PhaseId | "fertig" | "ohne"; title: string; count: number }>;
}

export function buildDashboard(db: Database.Database, now = Date.now()): Dashboard {
  const today = dayKey(now);
  const monthKey = today.slice(0, 7);
  const monthStart = berlinToMs(`${monthKey}-01`, "00:00");
  const [y, m] = monthKey.split("-").map(Number);
  const prevKey = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
  const prevStart = berlinToMs(`${prevKey}-01`, "00:00");
  // Vormonat nur bis zum gleichen Tag vergleichen (fairer Vergleich)
  const prevSameDay = Math.min(prevStart + (now - monthStart), monthStart);

  // ---------- Geld ----------
  const paid = db.prepare(`SELECT b.offer_id, b.price_cents, b.credit_cents, b.paid_at, b.exam_id, b.lines, s.starts_at
    FROM bookings b LEFT JOIN slots s ON s.id = b.slot_id WHERE b.paid_at IS NOT NULL AND COALESCE(b.provider,'') != 'guthaben'`).all() as PaidRow[];
  let revenueMonth = 0, revenuePrev = 0, tuevMonth = 0;
  const cat = new Map<Category, number>();
  const firstWeek = addDays(mondayOf(today), -7 * 9);
  const weeks: WeekBar[] = Array.from({ length: 14 }, (_, i) => {
    const mon = addDays(firstWeek, i * 7);
    const from = berlinToMs(mon, "00:00");
    const d = new Date(`${mon}T12:00:00Z`);
    return { label: `${d.getUTCDate()}.${d.getUTCMonth() + 1}.`, from, school: 0, tuev: 0, future: from > now };
  });
  const weekOf = (t: number) => weeks.findIndex((w, i) => t >= w.from && (i === weeks.length - 1 || t < weeks[i + 1].from));
  for (const r of paid) {
    const { school, tuev } = split(r);
    if (r.paid_at >= monthStart) {
      revenueMonth += school; tuevMonth += tuev;
      const c = categorize(r);
      cat.set(c, (cat.get(c) ?? 0) + school);
    } else if (r.paid_at >= prevStart && r.paid_at < prevSameDay) revenuePrev += school;
    const wi = weekOf(r.paid_at);
    if (wi >= 0 && !weeks[wi].future) { weeks[wi].school += school; weeks[wi].tuev += tuev; }
  }
  // Ausblick: schon bezahlte künftige Fahrten/Prüfungen nach Termin-Woche (gestrichelt)
  for (const r of paid) {
    if (!r.starts_at || r.starts_at <= now) continue;
    const wi = weekOf(r.starts_at);
    if (wi >= 0 && weeks[wi].future) weeks[wi].school += split(r).school;
  }
  const open = db.prepare(`SELECT COALESCE(SUM(price_cents - credit_cents),0) AS s, COUNT(*) AS n FROM bookings WHERE status = 'awaiting_payment'`).get() as { s: number; n: number };

  // ---------- Auslastung dieser Woche ----------
  const teacher = mainTeacherId(db);
  let workMin = 0, bookedMin = 0;
  if (teacher) {
    for (const day of workDaysOfWeek(mondayOf(today))) {
      const iv = workIntervals(day, dayRanges(db, teacher, day).ranges);
      workMin += iv.reduce((a, i) => a + (i.end - i.start) / 60_000, 0);
    }
    const wFrom = berlinToMs(mondayOf(today), "00:00"), wTo = berlinToMs(addDays(mondayOf(today), 7), "00:00");
    const rows = db.prepare(`SELECT starts_at, ends_at FROM slots WHERE status IN ('reserved','booked') AND starts_at >= ? AND starts_at < ?`).all(wFrom, wTo) as Array<{ starts_at: number; ends_at: number }>;
    bookedMin = rows.reduce((a, r) => a + (r.ends_at - r.starts_at) / 60_000, 0);
  }

  // ---------- Schüler ----------
  const students = db.prepare(`SELECT u.id, u.name, u.phone, u.created_at FROM users u WHERE u.role = 'student' ORDER BY u.name`).all() as Array<{ id: string; name: string; phone: string | null; created_at: string }>;
  const tfMin = testfahrtMinutes(db);
  const phaseCount = new Map<string, { title: string; count: number }>();
  const todo: Dashboard["todo"] = [];
  const calls: Dashboard["calls"] = [];
  let active = 0;
  const requested = db.prepare(`SELECT COUNT(*) AS n FROM bookings WHERE status = 'requested'`).get() as { n: number };
  if (requested.n) todo.push({ kind: "anfrage", text: `${requested.n} ${requested.n === 1 ? "Anfrage wartet" : "Anfragen warten"} auf deine Freigabe`, href: "/verwaltung/kalender" });

  for (const s of students) {
    const p = getProfile(db, s.id);
    if (!p) { phaseCount.set("ohne", { title: "Klasse noch offen", count: (phaseCount.get("ohne")?.count ?? 0) + 1 }); todo.push({ kind: "klasse", text: `Klasse festlegen`, href: `/verwaltung/schueler/${s.id}`, userName: s.name }); continue; }
    const records = listRecords(db, s.id);
    const planned = db.prepare(`SELECT b.kind, b.minutes FROM bookings b WHERE b.user_id = ? AND b.kind IS NOT NULL AND b.status IN ('requested','awaiting_payment','paid')
      AND NOT EXISTS (SELECT 1 FROM drive_records r WHERE r.booking_id = b.id)`).all(s.id) as Array<{ kind: string; minutes: number }>;
    const st = computeTraining(p, [...records, ...planned.map((x) => ({ kind: x.kind as never, minutes: x.minutes, status: "planned" as const }))], { testfahrtMinutes: tfMin });
    const key = p.passedAt ? "fertig" : st.current?.id ?? "fertig";
    const title = p.passedAt ? "Führerschein bestanden" : st.current?.title ?? "fertig";
    phaseCount.set(key, { title, count: (phaseCount.get(key)?.count ?? 0) + 1 });
    if (p.passedAt) continue;
    active++;
    const href = `/verwaltung/schueler/${s.id}`;

    // Was wartet auf die Fahrschule?
    if (st.current?.id === "reife") todo.push({ kind: "reife", text: "Wiederholung fertig – Prüfungsreife bestätigen?", href, userName: s.name });
    if (st.current?.id === "testfahrt" && records.some((r) => r.kind === "testfahrt" && r.status === "done")) todo.push({ kind: "testfahrt", text: "Testfahrt-Ergebnis eintragen", href, userName: s.name });
    const exams = listExams(db, s.id);
    for (const e of exams) if (e.status === "confirmed" && e.startsAt < now) todo.push({ kind: "ergebnis", text: `Ergebnis der ${e.type === "praxis" ? "praktischen Prüfung" : "Theorieprüfung"} eintragen`, href: `${href}#pruefungen`, userName: s.name });
    const hasActive = (t: string) => exams.some((e) => e.type === t && (e.status === "invited" || e.status === "confirmed" || e.status === "passed"));
    if (!hasActive("praxis") && examMissing(db, s.id, "praxis").length === 0) todo.push({ kind: "einladen", text: "Bereit für die praktische Prüfung – TÜV-Termin holen und einladen", href: `${href}#pruefungen`, userName: s.name });
    else if (!hasActive("theorie") && p.pruefauftragAt && !p.theoryPassedAt) todo.push({ kind: "einladen", text: "Prüfauftrag liegt vor – Theorieprüfung einladen", href: `${href}#pruefungen`, userName: s.name });

    // Lohnt sich anzurufen?
    const reasons: Array<[string, number]> = [];
    const doneMin = records.filter((r) => r.status === "done").reduce((a, r) => a + r.minutes, 0);
    const upcoming = db.prepare(`SELECT 1 FROM bookings b JOIN slots sl ON sl.id = b.slot_id WHERE b.user_id = ? AND b.status IN ('requested','awaiting_payment','paid') AND sl.starts_at > ?`).get(s.id, now);
    const lastAct = Math.max(Date.parse(s.created_at) || 0,
      (db.prepare(`SELECT MAX(created_at) AS t FROM bookings WHERE user_id = ? AND kind IS NOT NULL`).get(s.id) as { t: number | null }).t ?? 0,
      ...records.map((r) => r.at));
    const idle = Math.floor((now - lastAct) / DAY);
    const grundOk = grundbetragPaid(db, s.id);
    if (!grundOk) {
      const g = db.prepare(`SELECT MIN(created_at) AS t FROM bookings WHERE user_id = ? AND offer_id = 'fee-grundbetrag'`).get(s.id) as { t: number | null };
      const days = g.t ? Math.floor((now - g.t) / DAY) : 0;
      if (days >= 7) reasons.push([`Grundbetrag seit ${days} Tagen offen`, 40 + days]);
    } else if (!upcoming && idle >= IDLE_DAYS && st.current && !["reife", "pruefung"].includes(st.current.id)) {
      reasons.push([`Seit ${idle} Tagen keine Fahrt gebucht – erst ${Math.round((doneMin / 45) * 10) / 10} Std. gefahren`, 50 + idle]);
    }
    for (const e of exams) {
      if (e.status !== "invited") continue;
      const b = e.bookingId ? db.prepare(`SELECT pay_deadline FROM bookings WHERE id = ?`).get(e.bookingId) as { pay_deadline: number } | undefined : undefined;
      if (b && b.pay_deadline - now < DAY) reasons.push([`Prüfungseinladung noch nicht bestätigt – Frist läuft bald ab`, 100]);
    }
    const credit = creditBalance(db, s.id);
    if (credit >= 5000 && !upcoming) reasons.push([`Hat ${(credit / 100).toFixed(2).replace(".", ",")} € Guthaben, aber nichts gebucht`, 30]);
    if (reasons.length) calls.push({ userId: s.id, name: s.name, phone: s.phone, reason: reasons.map((r) => r[0]).join(" · "), score: Math.max(...reasons.map((r) => r[1])) });
  }
  calls.sort((a, b) => b.score - a.score);

  // ---------- Heute ----------
  const dFrom = berlinToMs(today, "00:00"), dTo = berlinToMs(addDays(today, 1), "00:00");
  const todayRows = db.prepare(`SELECT s.starts_at, s.ends_at, b.title, b.status, b.meeting_point, u.id AS uid, u.name FROM slots s
    JOIN bookings b ON b.slot_id = s.id JOIN users u ON u.id = b.user_id
    WHERE s.starts_at >= ? AND s.starts_at < ? AND b.status IN ('requested','awaiting_payment','paid') ORDER BY s.starts_at`).all(dFrom, dTo) as Row[];
  const todayList: Dashboard["today"] = todayRows.map((r) => ({
    start: Number(r.starts_at), end: Number(r.ends_at), title: r.title as string, userId: r.uid as string, userName: r.name as string,
    status: r.status as string, meeting: (r.meeting_point as string) ?? "", now: now >= Number(r.starts_at) && now < Number(r.ends_at),
  }));
  // Private Termine (im Kalender eingetragen – Schüler sehen nur, dass die Zeit belegt ist)
  for (const b of listBlocks(db, dFrom, dTo)) {
    if (b.note === STRIKE_NOTE) continue;
    todayList.push({ start: Math.max(b.startsAt, dFrom), end: Math.min(b.endsAt, dTo), title: b.note || "Privater Termin", userId: "", userName: "Privat",
      status: "private", meeting: "", now: now >= b.startsAt && now < b.endsAt, private: true });
  }
  todayList.sort((a, b) => a.start - b.start);

  // ---------- Warteliste, Prüfungen ----------
  const waits = (db.prepare(`SELECT w.user_id, w.day, w.from_min, w.to_min, u.name FROM waitlist w JOIN users u ON u.id = w.user_id WHERE w.day >= ? ORDER BY w.day, w.created_at`).all(today) as Row[])
    .map((r) => ({ userId: r.user_id as string, name: r.name as string, day: r.day as string, fromMin: Number(r.from_min), toMin: Number(r.to_min) }));
  const examRows = (db.prepare(`SELECT e.*, u.name FROM exams e JOIN users u ON u.id = e.user_id WHERE e.starts_at >= ? AND e.status IN ('invited','confirmed') ORDER BY e.starts_at LIMIT 8`).all(dFrom) as Row[])
    .map((r) => ({ id: r.id as string, userId: r.user_id as string, type: r.type as Exam["type"], startsAt: Number(r.starts_at), place: r.place as string,
      warmAt: r.warm_at == null ? null : Number(r.warm_at), status: r.status as Exam["status"], bookingId: (r.booking_id as string) ?? null,
      message: r.message as string, createdAt: Number(r.created_at), decidedAt: r.decided_at == null ? null : Number(r.decided_at), name: r.name as string }));

  const order: Array<string> = ["ohne", "einstieg", "schalter", "testfahrt", "uebung", "sonder", "wiederholung", "reife", "pruefung", "fertig"];
  const phases = [...phaseCount.entries()].sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]))
    .map(([id, v]) => ({ id: id as Dashboard["phases"][number]["id"], title: v.title, count: v.count }));

  return {
    kpi: {
      students: active, newStudents: students.filter((s) => (Date.parse(s.created_at) || 0) > now - 30 * DAY).length,
      revenueMonth, revenuePrev, tuevMonth, openPayments: open.s, openCount: open.n,
      utilization: workMin ? Math.round((bookedMin / workMin) * 100) : 0, bookedMin, workMin,
    },
    byCategory: [...cat.entries()].map(([c, cents]) => ({ cat: c, cents })).sort((a, b) => b.cents - a.cents),
    weeks, today: todayList, todo, calls: calls.slice(0, 8), waitlist: waits.slice(0, 10), exams: examRows, phases,
  };
}

