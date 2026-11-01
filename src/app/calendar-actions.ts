"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/server/db";
import { requireTeacher, requireUser } from "@/lib/server/auth";
import { BookingError, getBooking } from "@/lib/server/booking";
import { addBlock, bookDrive, dayRanges, deleteBlock, finishEarly, mainTeacherId, saveTemplate, setDayOverride, toggleStrike } from "@/lib/server/drive-booking";
import { isDriveKind } from "@/lib/server/training-repo";
import { notifySchool, notifyStudent, when } from "@/lib/server/payments/service";
import { applyShift, fillShiftText, planShift, ShiftError, type ShiftItem } from "@/lib/server/shift-day";
import { sendMessage } from "@/lib/server/chat";
import { formatPrice } from "@/lib/language-package";
import { addDays, berlinToMs, isDayKey } from "@/lib/time";
import type { DayRange } from "@/lib/calendar";

export interface ActionState { ok?: string; error?: string; warn?: string }
const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const toMin = (t: string) => { const m = /^(\d{1,2}):(\d{2})$/.exec(t); return m ? Number(m[1]) * 60 + Number(m[2]) : NaN; };
const refresh = () => { revalidatePath("/verwaltung/kalender"); revalidatePath("/verwaltung", "layout"); revalidatePath("/termine"); };

async function teacherId(): Promise<string> {
  await requireTeacher();
  const id = mainTeacherId(db());
  if (!id) throw new Error("Kein Fahrlehrer");
  return id;
}

/** Wochenvorlage: je Wochentag bis zu 3 Zeitbereiche (from0/to0 …). */
export async function saveWorkHoursAction(_p: ActionState, form: FormData): Promise<ActionState> {
  const tid = await teacherId();
  const days: DayRange[][] = [];
  for (let wd = 0; wd < 6; wd++) {
    const ranges: DayRange[] = [];
    for (let i = 0; i < 3; i++) {
      const f = toMin(str(form, `d${wd}f${i}`)), t = toMin(str(form, `d${wd}t${i}`));
      if (Number.isNaN(f) || Number.isNaN(t)) continue;
      if (t - f < 60) return { error: "Jeder Zeitbereich braucht mindestens 60 Minuten (Ende nach Beginn)." };
      ranges.push({ from: f, to: t });
    }
    days.push(ranges);
  }
  saveTemplate(db(), tid, days);
  refresh();
  const names = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
  const outside = days.flatMap((r, wd) => r.filter((x) => x.from < 540 || x.to > 1380).map(() => names[wd]));
  const lateWinter = days.flatMap((r, wd) => r.filter((x) => x.to > 1260).map(() => names[wd]));
  const warn = outside.length || lateWinter.length
    ? `Achtung: Dein Arbeitsrahmen ist 9–21 Uhr (Oktober–April) bzw. 9–23 Uhr (Mai–September). ${[...new Set([...outside, ...lateWinter])].join(", ")}: Zeiten außerhalb davon werden Schülern nicht angeboten. Soll der Rahmen anders sein, sag Bescheid.`
    : undefined;
  return { ok: "Gespeichert. Schüler sehen ab sofort die neuen freien Zeiten.", warn };
}

/** Sperrzeit: von Datum/Uhrzeit bis Datum/Uhrzeit (z. B. Urlaub, Arzttermin). */
export async function addBlockAction(_p: ActionState, form: FormData): Promise<ActionState> {
  const tid = await teacherId();
  const d1 = str(form, "fromDay"), d2 = str(form, "toDay") || d1;
  if (!isDayKey(d1) || !isDayKey(d2)) return { error: "Bitte ein Datum wählen." };
  const start = berlinToMs(d1, str(form, "fromTime") || "00:00");
  const end = str(form, "toTime") ? berlinToMs(d2, str(form, "toTime")) : berlinToMs(addDays(d2, 1), "00:00");
  try {
    addBlock(db(), tid, start, end, str(form, "note"));
  } catch (e) {
    return { error: (e as Error).message };
  }
  refresh();
  return { ok: "Gesperrt. Bereits gebuchte Fahrten in dieser Zeit bleiben bestehen – bitte bei Bedarf absagen." };
}

/** Einen ganzen Tag mit einem Tipp sperren. */
export async function blockDayAction(form: FormData): Promise<void> {
  const tid = await teacherId();
  const day = str(form, "day");
  if (isDayKey(day)) addBlock(db(), tid, berlinToMs(day, "00:00"), berlinToMs(addDays(day, 1), "00:00"), str(form, "note") || "Tag gesperrt");
  refresh();
}

export async function deleteBlockAction(form: FormData): Promise<void> {
  await teacherId();
  deleteBlock(db(), str(form, "id"));
  refresh();
}

// ---------- Einzelne Tage im Kalender anpassen -------------------------------------------

/** Stunde antippen → durchstreichen / wieder freigeben. */
export async function toggleHourAction(form: FormData): Promise<void> {
  const tid = await teacherId();
  const start = Number(str(form, "start")), end = Number(str(form, "end"));
  let msg = "";
  try {
    if (Number.isFinite(start) && end > start) toggleStrike(db(), tid, start, end);
  } catch (e) {
    msg = (e as Error).message;
  }
  refresh();
  if (msg) redirect(`/verwaltung/kalender?w=${str(form, "w")}&fehler=${encodeURIComponent(msg)}`);
}

/** „Feierabend ab …“ für einen Tag. */
export async function finishEarlyAction(form: FormData): Promise<void> {
  const tid = await teacherId();
  const day = str(form, "day"), m = toMin(str(form, "time"));
  if (isDayKey(day) && !Number.isNaN(m)) finishEarly(db(), tid, day, m);
  refresh();
}

/** Eigene Zeiten für ein Datum (bis zu 3 Bereiche) oder zurück zur Wochenvorlage. */
export async function saveDayAction(form: FormData): Promise<void> {
  const tid = await teacherId();
  const day = str(form, "day");
  if (!isDayKey(day)) return;
  if (str(form, "reset") === "1") { setDayOverride(db(), tid, day, null); refresh(); return; }
  const ranges: DayRange[] = [];
  for (let i = 0; i < 3; i++) {
    const f = toMin(str(form, `f${i}`)), t = toMin(str(form, `t${i}`));
    if (!Number.isNaN(f) && !Number.isNaN(t) && t > f) ranges.push({ from: f, to: t });
  }
  setDayOverride(db(), tid, day, ranges);
  refresh();
}

// ---------- Schüler bucht eine Fahrt ------------------------------------------------

export async function bookDriveAction(form: FormData): Promise<void> {
  const user = await requireUser();
  const kind = str(form, "kind");
  let target = "/termine?gebucht=1#offen";
  try {
    if (!isDriveKind(kind)) throw new BookingError("Bitte die Art der Fahrt wählen.");
    const b = bookDrive(db(), {
      userId: user.id, kind, minutes: Number(str(form, "minutes")), start: Number(str(form, "start")),
      meetingPoint: str(form, "meeting"), note: str(form, "note"),
    });
    if (b.status === "requested") {
      notifySchool(b, `Neue Anfrage: ${user.name}`, `${user.name} möchte ${b.title} am ${when(b)} (${formatPrice(b.priceCents)}). Bitte bestätigen oder ablehnen.`);
      target = "/termine?angefragt=1#meine";
    }
  } catch (e) {
    const msg = e instanceof BookingError ? e.message : "Das hat nicht geklappt. Bitte versuche es noch einmal.";
    if (!(e instanceof BookingError)) console.error(e);
    target = `/termine?fehler=${encodeURIComponent(msg)}&k=${kind}&d=${str(form, "minutes")}#buchen`;
  }
  refresh();
  redirect(target);
}

// ---------- Ganzen Tag verschieben ---------------------------------------------------------

/** Alle Termine eines Tages ab Uhrzeit um X Minuten verschieben und alle betroffenen Schüler benachrichtigen. */
export async function shiftDayAction(form: FormData): Promise<void> {
  const teacher = await requireTeacher();
  const day = str(form, "day"), week = str(form, "w");
  const fromMin = toMin(str(form, "from") || "00:00"), delta = Number(str(form, "delta"));
  const back = (msg: string, ok = false) => redirect(`/verwaltung/kalender?w=${week || day}&${ok ? "ok" : "fehler"}=${encodeURIComponent(msg)}`);
  if (!isDayKey(day) || Number.isNaN(fromMin) || !Number.isFinite(delta) || delta === 0 || Math.abs(delta) > 240) back("Bitte Tag, Uhrzeit und Minuten wählen.");
  let items: ShiftItem[] = [];
  try {
    items = planShift(db(), day, fromMin, delta);
  } catch (e) {
    if (e instanceof ShiftError) back(e.message);
    throw e;
  }
  if (!items.length) back("An diesem Tag gibt es ab dieser Uhrzeit keine Termine zum Verschieben.");
  applyShift(db(), items);
  const text = str(form, "text");
  if (form.get("notify") === "on") {
    for (const it of items) {
      const body = fillShiftText(text || "Hallo {name}, dein Termin heute verschiebt sich um {minuten} Minuten: neu um {neu} Uhr statt {alt} Uhr.", it, delta);
      try { sendMessage(db(), { studentId: it.userId, sender: "school", senderId: teacher.id, body }); } catch { /* Chat optional */ }
      const b = getBooking(db(), it.bookingId);
      if (b) notifyStudent(b, "Dein Termin wurde verschoben", body);
    }
  }
  refresh();
  revalidatePath("/verwaltung/uebersicht");
  back(`${items.length} ${items.length === 1 ? "Termin" : "Termine"} um ${delta > 0 ? "+" : ""}${delta} Minuten verschoben${form.get("notify") === "on" ? " – alle wurden benachrichtigt (Chat + Mitteilung)" : ""}.`, true);
}
