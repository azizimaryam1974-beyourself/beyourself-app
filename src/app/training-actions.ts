"use server";

import { auditAction } from "@/lib/server/audit-context";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/server/db";
import { requireTeacher } from "@/lib/server/auth";
import { getUser } from "@/lib/server/repo";
import { addRecord, deleteRecord, ensureProfile, getProfile, isDriveKind, isTrainingClass, setRecordStatus, updateProfile } from "@/lib/server/training-repo";
import { notifyUser } from "@/lib/server/payments/service";
import { applyNoShow } from "@/lib/server/cancel";
import { formatPrice } from "@/lib/language-package";
import { berlinToMs, isDayKey } from "@/lib/time";
import { CLASS_LABEL, KIND_LABEL, MIN_REPEAT, type RecordStatus } from "@/lib/training";

export interface ActionState { ok?: string; error?: string }
const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const intOrNull = (s: string) => (s === "" ? null : Number.isFinite(Number(s)) ? Math.round(Number(s)) : NaN);

function student(userId: string) {
  const u = getUser(db(), userId);
  if (!u || u.role !== "student") throw new Error("Schüler nicht gefunden");
  return u;
}
const refresh = (userId: string) => { revalidatePath(`/verwaltung/schueler/${userId}`); revalidatePath("/verwaltung"); revalidatePath("/konto"); };

/** Klasse festlegen (auch für Schüler, die sich vor der Klassenwahl angemeldet haben). */
export async function setClassAction(form: FormData): Promise<void> {
  await auditAction("training-actions:setClassAction", [form]);
  await requireTeacher();
  const userId = str(form, "userId"), c = str(form, "licenseClass");
  student(userId);
  if (!isTrainingClass(c)) redirect(`/verwaltung/schueler/${userId}?fehler=${encodeURIComponent("Bitte eine Klasse auswählen.")}`);
  try {
    if (!getProfile(db(), userId)) ensureProfile(db(), userId, c);
    else updateProfile(db(), userId, { licenseClass: c });
    if (getProfile(db(), userId)?.licenseClass !== c) throw new Error("nicht gespeichert");
  } catch (e) {
    console.error("[klasse]", (e as Error).message);
    redirect(`/verwaltung/schueler/${userId}?fehler=${encodeURIComponent(`Die Klasse konnte nicht gespeichert werden (${(e as Error).message}). Bitte Claude Bescheid geben.`)}`);
  }
  refresh(userId);
}

export async function saveTargetsAction(_p: ActionState, form: FormData): Promise<ActionState> {
  await auditAction("training-actions:saveTargetsAction", [_p, form]);
  await requireTeacher();
  const userId = str(form, "userId");
  const u = student(userId);
  const before = getProfile(db(), userId);
  if (!before) return { error: "Bitte zuerst die Klasse festlegen." };
  const practice = intOrNull(str(form, "practiceTarget"));
  const repeat = Number(str(form, "repeatTarget") || MIN_REPEAT);
  const maxPerWeek = Number(str(form, "maxPerWeek") || before.maxPerWeek);
  if (Number.isNaN(practice) || !Number.isFinite(repeat) || !Number.isFinite(maxPerWeek)) return { error: "Bitte nur Zahlen eintragen." };
  const after = updateProfile(db(), userId, {
    practiceTarget: before.licenseClass === "b197" ? null : practice, repeatTarget: repeat, maxPerWeek,
    manualApproval: form.get("manualApproval") === "on", blocked: form.get("blocked") === "on",
  });
  const msg: string[] = [];
  const note = str(form, "message");
  if (after.repeatTarget !== before.repeatTarget && form.get("notify") === "on") {
    notifyUser(u, "Wiederholungsphase angepasst",
      `${note ? note + "\n\n" : ""}Für deine Wiederholungsphase sind jetzt ${after.repeatTarget} Stunden vorgesehen.`);
    msg.push("Schüler benachrichtigt");
  }
  if (after.practiceTarget !== before.practiceTarget && after.practiceTarget !== null && form.get("notify") === "on") {
    notifyUser(u, "Übungsfahrten festgelegt", `${note ? note + "\n\n" : ""}Dein Fahrlehrer hat ${after.practiceTarget} Übungsstunden für dich vorgesehen.`);
    msg.push("Schüler benachrichtigt");
  }
  refresh(userId);
  return { ok: ["Gespeichert", ...new Set(msg)].join(" · ") + "." };
}

/** B197-Testfahrt: bestanden oder nicht bestanden (+ zusätzliche Schaltstunden). */
export async function testfahrtAction(form: FormData): Promise<void> {
  await auditAction("training-actions:testfahrtAction", [form]);
  await requireTeacher();
  const userId = str(form, "userId");
  const u = student(userId);
  const p = getProfile(db(), userId);
  if (!p || p.licenseClass !== "b197") return;
  if (str(form, "result") === "passed") {
    updateProfile(db(), userId, { testfahrtPassedAt: Date.now() });
    notifyUser(u, "Testfahrt bestanden 🎉", "Glückwunsch – du hast die Testfahrt bestanden. Jetzt sind die Sonderfahrten für dich freigeschaltet.", "/termine");
  } else if (str(form, "result") === "failed") {
    const extra = Math.min(20, Math.max(1, Number(str(form, "extra")) || 2));
    updateProfile(db(), userId, { testfahrtPassedAt: null, extraManual: p.extraManual + extra });
    notifyUser(u, "Testfahrt: noch etwas üben", `Bei der Testfahrt hat es noch nicht ganz gereicht. Für dich sind ${extra} weitere Schaltstunden freigeschaltet, danach kannst du die Testfahrt wiederholen.`, "/termine");
  } else if (str(form, "result") === "reset") {
    updateProfile(db(), userId, { testfahrtPassedAt: null });
  }
  refresh(userId);
}

/** Prüfungsreife bestätigen (Nachricht „Zertifizierung“) oder zurücknehmen. */
export async function examReadyAction(form: FormData): Promise<void> {
  await auditAction("training-actions:examReadyAction", [form]);
  await requireTeacher();
  const userId = str(form, "userId");
  const u = student(userId);
  if (form.get("ready") === "1") {
    updateProfile(db(), userId, { examReadyAt: Date.now() });
    notifyUser(u, "Freigabe für die Prüfung ✓",
      `${str(form, "message") || "Dein Fahrlehrer bestätigt: Du bist bereit für die Prüfung."}\n\nAls Nächstes zahlst du Warmstunde und Prüfungsgebühr. Den Prüfungstermin bekommst du von uns, sobald der TÜV ihn bestätigt hat.`);
  } else {
    updateProfile(db(), userId, { examReadyAt: null });
  }
  refresh(userId);
}

const DOCS = ["sehtestAt", "ersteHilfeAt", "antragAt", "pruefauftragAt", "theoryPassedAt"] as const;

export async function saveDocsAction(form: FormData): Promise<void> {
  await auditAction("training-actions:saveDocsAction", [form]);
  await requireTeacher();
  const userId = str(form, "userId");
  student(userId);
  const p = getProfile(db(), userId);
  if (!p) return;
  const patch: Record<string, number | null> = {};
  for (const k of DOCS) {
    const on = form.get(k) === "on";
    patch[k] = on ? (p[k] ?? Date.now()) : null; // Datum bleibt beim erneuten Speichern erhalten
  }
  updateProfile(db(), userId, { ...patch, teacherNote: str(form, "teacherNote") });
  refresh(userId);
}

/** Fahrt nachtragen (z. B. vor Einführung der App gefahren oder bar bezahlt). */
export async function addRecordAction(_p: ActionState, form: FormData): Promise<ActionState> {
  await auditAction("training-actions:addRecordAction", [_p, form]);
  const teacher = await requireTeacher();
  const userId = str(form, "userId");
  student(userId);
  const kind = str(form, "kind"), date = str(form, "date");
  const minutes = Number(str(form, "minutes"));
  if (!isDriveKind(kind)) return { error: "Bitte die Art wählen." };
  if (!isDayKey(date)) return { error: "Bitte ein Datum wählen." };
  try {
    addRecord(db(), { userId, kind, minutes, at: berlinToMs(date, str(form, "time") || "12:00"), status: "done", note: str(form, "note"), createdBy: teacher.id });
  } catch (e) {
    return { error: (e as Error).message };
  }
  refresh(userId);
  return { ok: `${minutes} Min ${KIND_LABEL[kind]} eingetragen.` };
}

export async function recordStatusAction(form: FormData): Promise<void> {
  await auditAction("training-actions:recordStatusAction", [form]);
  await requireTeacher();
  const userId = str(form, "userId");
  const status = str(form, "status") as RecordStatus;
  const recordId = str(form, "recordId");
  if (str(form, "do") === "delete") deleteRecord(db(), recordId);
  else if (["done", "no_show", "late", "planned"].includes(status)) {
    setRecordStatus(db(), recordId, status);
    // Gebuchte Fahrt: nicht erschienen / zu spät → 75 % berechnet, 25 % Guthaben (zurücknehmbar)
    const rec = db().prepare(`SELECT booking_id FROM drive_records WHERE id = ?`).get(recordId) as { booking_id: string | null } | undefined;
    if (rec?.booking_id) {
      const credit = applyNoShow(db(), rec.booking_id, status === "no_show" || status === "late");
      const u = getUser(db(), userId);
      if (u && credit > 0) notifyUser(u, status === "late" ? "Fahrt ausgefallen (zu spät)" : "Fahrt ausgefallen (nicht erschienen)",
        `Deine Fahrt ist ausgefallen, weil du ${status === "late" ? "mehr als 15 Minuten zu spät warst" : "nicht erschienen bist"}. Laut Buchungsbedingungen werden 75 % berechnet; ${formatPrice(credit)} bekommst du als Guthaben.`, "/termine#guthaben");
    }
  }
  refresh(userId);
}

