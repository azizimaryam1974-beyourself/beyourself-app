/**
 * Ausbildungsablauf – reine Logik (ohne Datenbank, dadurch gut testbar).
 * Gezählt wird in MINUTEN. Eine „Stunde“ im Sinne der Ausbildung = 45 Minuten
 * (z. B. 5 Überlandstunden = 225 Min). Buchbar sind Fahrten von 60, 75 oder 90 Minuten,
 * Beleuchtungsfahrten zusätzlich 135 Minuten. Preis anteilig zum 45-Minuten-Preis.
 * Siehe ARBEITSWEISE.md.
 */

export type TrainingClass = "b" | "b197" | "b78" | "umschreibung";
export type DriveKind = "automatik" | "schalter" | "ueberland" | "autobahn" | "beleuchtung" | "wiederholung" | "testfahrt" | "warmstunde" | "pruefung";
export type RecordStatus = "planned" | "done" | "no_show" | "late";
export type PhaseId = "einstieg" | "schalter" | "testfahrt" | "uebung" | "sonder" | "wiederholung" | "reife" | "pruefung";

export const CLASS_LABEL: Record<TrainingClass, string> = { b: "Klasse B", b197: "Klasse B197", b78: "Klasse B78", umschreibung: "Umschreibung" };
export const KIND_LABEL: Record<DriveKind, string> = {
  automatik: "Übungsfahrt Automatik", schalter: "Übungsfahrt Schalter", ueberland: "Überlandfahrt", autobahn: "Autobahnfahrt",
  beleuchtung: "Beleuchtungsfahrt", wiederholung: "Wiederholung", testfahrt: "Testfahrt", warmstunde: "Warmstunde", pruefung: "Praktische Prüfung",
};
export const TRAINING_CLASSES = Object.keys(CLASS_LABEL) as TrainingClass[];
export const DRIVE_KINDS = Object.keys(KIND_LABEL) as DriveKind[];

/** Pflicht-Sonderfahrten (Einheiten à 45 Min). */
export const SPECIAL = { ueberland: 5, autobahn: 4, beleuchtung: 3 } as const;
export const LESSON_MIN = 45;
/** Erlaubte Fahrtlängen in Minuten. */
export const DURATIONS = [60, 75, 90] as const;
export const DURATIONS_DARK = [60, 75, 90, 135] as const;
/** Die erste Überland- und Autobahnfahrt muss mindestens so lang sein. */
export const INTRO_MIN = 90;

export interface PriceConfig { practice45: number; special45: number; testfahrtMinutes: 30 | 45; testfahrt30: number; testfahrt45: number; warmstunde30: number }
export const DEFAULT_PRICES: PriceConfig = { practice45: 6800, special45: 7500, testfahrtMinutes: 30, testfahrt30: 4500, testfahrt45: 6800, warmstunde30: 4500 };

/** Preis in Cent, anteilig zum 45-Minuten-Preis (auf den Cent gerundet). */
export function priceCents(kind: DriveKind, minutes: number, cfg: PriceConfig = DEFAULT_PRICES): number {
  if (kind === "testfahrt") return cfg.testfahrtMinutes === 45 ? cfg.testfahrt45 : cfg.testfahrt30;
  if (kind === "warmstunde") return Math.round((cfg.warmstunde30 * minutes) / 30);
  const base = kind === "ueberland" || kind === "autobahn" || kind === "beleuchtung" ? cfg.special45 : cfg.practice45;
  return Math.round((base * minutes) / LESSON_MIN);
}

export interface TrainingProfile {
  licenseClass: TrainingClass;
  /** Übungsfahrten (B, B78, Umschreibung): Zahl legt der Fahrlehrer fest; null = noch offen. */
  practiceTarget: number | null;
  /** Wiederholungsphase, mindestens 3 – Fahrlehrer kann erhöhen. */
  repeatTarget: number;
  /** B197: zusätzliche Schaltstunden nach nicht bestandener Testfahrt. */
  extraManual: number;
  testfahrtPassedAt: number | null;
  examReadyAt: number | null;
  theoryPassedAt: number | null;
  pruefauftragAt: number | null;
  /** Praktische Prüfung bestanden */
  passedAt?: number | null;
}

export interface DriveRecord { kind: DriveKind; minutes: number; status: RecordStatus }

/** done/planned/target in Minuten; binary = Ja/Nein-Schritt (Testfahrt, Reife, Unterlagen). */
export interface Counter { kind: DriveKind; label: string; done: number; planned: number; target: number | null; binary?: boolean }
export type PhaseStatus = "done" | "active" | "locked";
export interface Phase { id: PhaseId; title: string; hint: string; status: PhaseStatus; counters: Counter[] }

/** Was darf der Schüler jetzt buchen? durations = erlaubte Fahrtlängen (Min), remaining = offene Minuten. */
export interface BookableOption { kind: DriveKind; durations: number[]; remaining: number | null }

export interface TrainingState {
  phases: Phase[];
  current: Phase | null;
  bookable: BookableOption[];
  /** Kurzer Satz für den Schüler: was als Nächstes kommt. */
  next: string;
  /** 0–100 für die Gesamtanzeige */
  percent: number;
}

export const MIN_REPEAT = 3;
const B197_AUTO = 3 * LESSON_MIN, B197_MANUAL = 10 * LESSON_MIN;

function sum(records: DriveRecord[], kind: DriveKind, status: RecordStatus): number {
  return records.filter((r) => r.kind === kind && r.status === status).reduce((a, r) => a + r.minutes, 0);
}

/** Einheiten, die als „gefahren“ zählen (nicht erschienen/zu spät zählt nicht). */
const doneOf = (r: DriveRecord[], k: DriveKind) => sum(r, k, "done");
const plannedOf = (r: DriveRecord[], k: DriveKind) => sum(r, k, "planned");

function counter(r: DriveRecord[], kind: DriveKind, target: number | null, label = KIND_LABEL[kind]): Counter {
  return { kind, label, done: doneOf(r, kind), planned: plannedOf(r, kind), target };
}

const complete = (c: Counter) => c.target !== null && c.done >= c.target;

/** Lässt sich `total` genau aus den erlaubten Längen zusammensetzen? */
function composable(total: number, all: readonly number[], memo = new Map<number, boolean>()): boolean {
  if (total === 0) return true;
  if (total < 0) return false;
  if (memo.has(total)) return memo.get(total)!;
  const r = all.some((d) => composable(total - d, all, memo));
  memo.set(total, r);
  return r;
}

/**
 * Erlaubte Längen für die noch offenen Minuten. Angeboten werden nur Längen, nach denen der Rest
 * noch genau aufgeht (z. B. bei 135 Min offen: 60 oder 75, nicht 90 – sonst blieben 45 Min übrig).
 * Geht es nicht genau auf (oder ist weniger als 60 Min offen), wird die kürzeste passende Länge erlaubt.
 */
export function durationsFor(remaining: number | null, all: readonly number[] = DURATIONS): number[] {
  if (remaining === null) return [...all];
  if (remaining <= 0) return [];
  const exact = all.filter((d) => d <= remaining && composable(remaining - d, all));
  if (exact.length) return exact;
  const fitting = all.filter((d) => d <= remaining);
  return fitting.length ? fitting : [all[0]];
}

/** Hat der Schüler schon eine Fahrt dieser Art mit mind. 90 Min gefahren? */
export function hasLongDrive(records: DriveRecord[], kind: DriveKind, statuses: RecordStatus[] = ["done"]): boolean {
  return records.some((r) => r.kind === kind && statuses.includes(r.status) && r.minutes >= INTRO_MIN);
}

export function computeTraining(p: TrainingProfile, records: DriveRecord[], opts: { testfahrtMinutes: number } = { testfahrtMinutes: 30 }): TrainingState {
  const phases: Phase[] = [];
  const practiceKind: DriveKind = p.licenseClass === "b78" ? "automatik" : "schalter";
  const repeatTarget = Math.max(MIN_REPEAT, p.repeatTarget || MIN_REPEAT);

  if (p.licenseClass === "b197") {
    phases.push(
      { id: "einstieg", title: "Einstieg mit Automatik", hint: "Gefühl für Auto und Straße bekommen.", status: "locked", counters: [counter(records, "automatik", B197_AUTO)] },
      { id: "schalter", title: "Schaltwagen", hint: "Kuppeln und Schalten sicher beherrschen – beliebig verteilt.", status: "locked", counters: [counter(records, "schalter", B197_MANUAL + p.extraManual * LESSON_MIN)] },
      { id: "testfahrt", title: "Testfahrt", hint: "Der Fahrlehrer bestätigt, dass du sicher schalten kannst.", status: "locked",
        counters: [{ kind: "testfahrt", label: "Testfahrt bestanden", done: p.testfahrtPassedAt ? 1 : 0, planned: plannedOf(records, "testfahrt") > 0 ? 1 : 0, target: 1, binary: true }] },
    );
  } else {
    phases.push({
      id: "uebung", title: p.licenseClass === "b78" ? "Übungsfahrten (Automatik)" : "Übungsfahrten",
      hint: p.practiceTarget === null ? "Wie viele Stunden du brauchst, legt dein Fahrlehrer fest." : "Grundlagen und Stadtverkehr.",
      status: "locked", counters: [counter(records, practiceKind, p.practiceTarget === null ? null : p.practiceTarget * LESSON_MIN, "Übungsfahrten")],
    });
  }
  if (p.licenseClass !== "umschreibung") {
    phases.push({
      id: "sonder", title: "Sonderfahrten", hint: "Zuerst je 90 Min Überland und Autobahn, danach alles frei kombinierbar.", status: "locked",
      counters: [counter(records, "ueberland", SPECIAL.ueberland * LESSON_MIN), counter(records, "autobahn", SPECIAL.autobahn * LESSON_MIN), counter(records, "beleuchtung", SPECIAL.beleuchtung * LESSON_MIN)],
    });
  }
  phases.push(
    { id: "wiederholung", title: "Wiederholungsphase", hint: "Einmal alles zusammen – bis es sitzt.", status: "locked", counters: [counter(records, "wiederholung", repeatTarget * LESSON_MIN)] },
    { id: "reife", title: "Prüfungsreife", hint: "Dein Fahrlehrer bestätigt: bereit für die Prüfung.", status: "locked",
      counters: [{ kind: "pruefung", label: "Bestätigt", done: p.examReadyAt ? 1 : 0, planned: 0, target: 1, binary: true }] },
    { id: "pruefung", title: "Prüfung", hint: "Termin bekommst du von der Fahrschule (nach TÜV-Bestätigung).", status: "locked",
      counters: [
        { kind: "pruefung", label: "Theorieprüfung bestanden", done: p.theoryPassedAt ? 1 : 0, planned: 0, target: 1, binary: true },
        { kind: "pruefung", label: "Prüfauftrag liegt vor", done: p.pruefauftragAt ? 1 : 0, planned: 0, target: 1, binary: true },
        { kind: "pruefung", label: "Praktische Prüfung bestanden", done: p.passedAt ? 1 : 0, planned: 0, target: 1, binary: true },
      ] },
  );

  // Status: Phasen nacheinander; eine Phase ist fertig, wenn alle Zähler erfüllt sind.
  let open = false;
  for (const ph of phases) {
    const finished = ph.id === "pruefung" ? !!p.passedAt : ph.counters.every(complete);
    if (p.passedAt) ph.status = "done"; // Führerschein bestanden → alles erledigt
    else if (open) ph.status = "locked";
    else if (finished) ph.status = "done";
    else { ph.status = "active"; open = true; }
  }
  const current = phases.find((ph) => ph.status === "active") ?? null;

  // Buchbar – nur in der aktiven Phase; gebuchte (geplante) Minuten zählen schon mit.
  const bookable: BookableOption[] = [];
  const remainingOf = (c: Counter) => (c.target === null ? null : c.target - c.done - c.planned);
  if (current) {
    if (["einstieg", "schalter", "uebung", "wiederholung"].includes(current.id)) {
      const c = current.counters[0];
      const rem = remainingOf(c);
      const durations = durationsFor(rem);
      if (durations.length) bookable.push({ kind: c.kind, durations, remaining: rem });
    } else if (current.id === "testfahrt") {
      if (!plannedOf(records, "testfahrt")) bookable.push({ kind: "testfahrt", durations: [opts.testfahrtMinutes], remaining: null });
    } else if (current.id === "sonder") {
      const [ue, ab, be] = current.counters;
      // Einstieg: zuerst je eine Fahrt von mind. 90 Min Überland und Autobahn (gebuchte zählen, damit beide planbar sind).
      const introDone = hasLongDrive(records, "ueberland") && hasLongDrive(records, "autobahn");
      for (const c of [ue, ab]) {
        const rem = remainingOf(c)!;
        if (rem <= 0) continue;
        if (introDone) bookable.push({ kind: c.kind, durations: durationsFor(rem), remaining: rem });
        else if (!hasLongDrive(records, c.kind, ["done", "planned"])) {
          bookable.push({ kind: c.kind, durations: durationsFor(rem).filter((d) => d >= INTRO_MIN), remaining: rem });
        }
      }
      const remBe = remainingOf(be)!;
      if (introDone && remBe > 0) bookable.push({ kind: "beleuchtung", durations: durationsFor(remBe, DURATIONS_DARK), remaining: remBe });
    }
  }

  // Gesamtfortschritt: Anteil erledigter Einheiten über alle Zähler mit Ziel
  let doneU = 0, totalU = 0;
  for (const ph of phases) for (const c of ph.counters) {
    if (c.binary) { totalU += LESSON_MIN; doneU += c.done ? LESSON_MIN : 0; continue; }
    if (c.target === null) { totalU += Math.max(c.done, LESSON_MIN); continue; }
    totalU += c.target; doneU += Math.min(c.done, c.target);
  }
  const percent = totalU ? Math.round((doneU / totalU) * 100) : 0;

  return { phases, current, bookable, next: nextText(current, bookable, p), percent };
}

function nextText(current: Phase | null, bookable: BookableOption[], p: TrainingProfile): string {
  if (!current) return p.passedAt ? "Führerschein bestanden – herzlichen Glückwunsch!" : "Alles erledigt – viel Erfolg!";
  if (current.id === "reife") return "Dein Fahrlehrer prüft, ob du bereit für die Prüfung bist.";
  if (current.id === "pruefung") {
    if (!p.theoryPassedAt) return "Nächster Schritt: Theorieprüfung bestehen.";
    if (!p.pruefauftragAt) return "Wir warten auf den Prüfauftrag der Führerscheinstelle.";
    return "Du bekommst eine Einladung zur praktischen Prüfung, sobald der TÜV-Termin feststeht.";
  }
  if (current.id === "testfahrt" && !bookable.length) return "Deine Testfahrt ist gebucht.";
  if (current.id === "uebung" && current.counters[0].target === null) return "Buche Übungsfahrten – dein Fahrlehrer legt fest, wie viele du brauchst.";
  if (!bookable.length) return `${current.title}: alles gebucht – jetzt fahren!`;
  return `Als Nächstes: ${bookable.map((b) => KIND_LABEL[b.kind]).join(", ")}`;
}

/** Prüft eine konkrete Buchung (Art + Minuten) gegen den Ausbildungsstand. */
export function canBook(state: TrainingState, kind: DriveKind, minutes: number): { ok: true } | { ok: false; reason: string } {
  const opt = state.bookable.find((b) => b.kind === kind);
  if (!opt) return { ok: false, reason: `${KIND_LABEL[kind]} ist für dich gerade nicht buchbar. ${state.next}` };
  if (!opt.durations.includes(minutes)) {
    return { ok: false, reason: `Für ${KIND_LABEL[kind]} kannst du gerade ${opt.durations.join(", ")} Minuten buchen.` };
  }
  return { ok: true };
}

/** "225 Min" → "5 Std." (Ausbildungsstunden à 45 Min, auf 0,1 gerundet) */
export function asLessons(min: number): string {
  const v = Math.round((min / LESSON_MIN) * 10) / 10;
  return `${String(v).replace(".", ",")} Std.`;
}
