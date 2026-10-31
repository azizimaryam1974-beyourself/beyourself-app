/**
 * Ausbildungsablauf – reine Logik (ohne Datenbank, dadurch gut testbar).
 * Eine „Stunde“ = 45 Minuten = 1 Einheit. Gebucht wird in 90-Minuten-Blöcken (2 Einheiten);
 * nur die letzte Einheit einer Phase darf einzeln gebucht werden.
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
}

export interface DriveRecord { kind: DriveKind; units: number; status: RecordStatus }

export interface Counter { kind: DriveKind; label: string; done: number; planned: number; target: number | null }
export type PhaseStatus = "done" | "active" | "locked";
export interface Phase { id: PhaseId; title: string; hint: string; status: PhaseStatus; counters: Counter[] }

/** Was darf der Schüler jetzt buchen? sizes = erlaubte Blockgrößen in Einheiten. */
export interface BookableOption { kind: DriveKind; sizes: number[]; remaining: number | null }

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
const B197_AUTO = 3, B197_MANUAL = 10;

function sum(records: DriveRecord[], kind: DriveKind, status: RecordStatus): number {
  return records.filter((r) => r.kind === kind && r.status === status).reduce((a, r) => a + r.units, 0);
}

/** Einheiten, die als „gefahren“ zählen (nicht erschienen/zu spät zählt nicht). */
const doneOf = (r: DriveRecord[], k: DriveKind) => sum(r, k, "done");
const plannedOf = (r: DriveRecord[], k: DriveKind) => sum(r, k, "planned");

function counter(r: DriveRecord[], kind: DriveKind, target: number | null, label = KIND_LABEL[kind]): Counter {
  return { kind, label, done: doneOf(r, kind), planned: plannedOf(r, kind), target };
}

const complete = (c: Counter) => c.target !== null && c.done >= c.target;

/** Blockgrößen: normal 90 Min; ist nur noch 1 Einheit offen, darf einzeln gebucht werden. */
function sizesFor(remaining: number | null): number[] {
  if (remaining === null) return [2];
  if (remaining <= 0) return [];
  return remaining === 1 ? [1] : [2];
}

/** Hat der Schüler schon einen zusammenhängenden 90-Min-Block dieser Art gefahren? */
export function hasDoubleBlock(blocks: DriveRecord[], kind: DriveKind): boolean {
  return blocks.some((b) => b.kind === kind && b.status === "done" && b.units >= 2);
}

export function computeTraining(p: TrainingProfile, records: DriveRecord[]): TrainingState {
  const phases: Phase[] = [];
  const practiceKind: DriveKind = p.licenseClass === "b78" ? "automatik" : "schalter";
  const repeatTarget = Math.max(MIN_REPEAT, p.repeatTarget || MIN_REPEAT);

  if (p.licenseClass === "b197") {
    phases.push(
      { id: "einstieg", title: "Einstieg mit Automatik", hint: "Gefühl für Auto und Straße bekommen.", status: "locked", counters: [counter(records, "automatik", B197_AUTO)] },
      { id: "schalter", title: "Schaltwagen", hint: "Kuppeln und Schalten sicher beherrschen – beliebig verteilt.", status: "locked", counters: [counter(records, "schalter", B197_MANUAL + p.extraManual)] },
      { id: "testfahrt", title: "Testfahrt", hint: "Der Fahrlehrer bestätigt, dass du sicher schalten kannst.", status: "locked",
        counters: [{ kind: "testfahrt", label: "Testfahrt bestanden", done: p.testfahrtPassedAt ? 1 : 0, planned: plannedOf(records, "testfahrt") > 0 ? 1 : 0, target: 1 }] },
    );
  } else {
    phases.push({
      id: "uebung", title: p.licenseClass === "b78" ? "Übungsfahrten (Automatik)" : "Übungsfahrten",
      hint: p.practiceTarget === null ? "Wie viele Stunden du brauchst, legt dein Fahrlehrer fest." : "Grundlagen und Stadtverkehr.",
      status: "locked", counters: [counter(records, practiceKind, p.practiceTarget, "Übungsfahrten")],
    });
  }
  if (p.licenseClass !== "umschreibung") {
    phases.push({
      id: "sonder", title: "Sonderfahrten", hint: "Zuerst je 90 Min Überland und Autobahn, danach alles frei kombinierbar.", status: "locked",
      counters: [counter(records, "ueberland", SPECIAL.ueberland), counter(records, "autobahn", SPECIAL.autobahn), counter(records, "beleuchtung", SPECIAL.beleuchtung)],
    });
  }
  phases.push(
    { id: "wiederholung", title: "Wiederholungsphase", hint: "Einmal alles zusammen – bis es sitzt.", status: "locked", counters: [counter(records, "wiederholung", repeatTarget)] },
    { id: "reife", title: "Prüfungsreife", hint: "Dein Fahrlehrer bestätigt: bereit für die Prüfung.", status: "locked",
      counters: [{ kind: "pruefung", label: "Bestätigt", done: p.examReadyAt ? 1 : 0, planned: 0, target: 1 }] },
    { id: "pruefung", title: "Prüfung", hint: "Termin bekommst du von der Fahrschule (nach TÜV-Bestätigung).", status: "locked",
      counters: [
        { kind: "pruefung", label: "Theorieprüfung bestanden", done: p.theoryPassedAt ? 1 : 0, planned: 0, target: 1 },
        { kind: "pruefung", label: "Prüfauftrag liegt vor", done: p.pruefauftragAt ? 1 : 0, planned: 0, target: 1 },
      ] },
  );

  // Status: Phasen nacheinander; eine Phase ist fertig, wenn alle Zähler erfüllt sind.
  let open = false;
  for (const ph of phases) {
    const finished = ph.id === "pruefung" ? false : ph.counters.every(complete);
    if (open) ph.status = "locked";
    else if (finished) ph.status = "done";
    else { ph.status = "active"; open = true; }
  }
  const current = phases.find((ph) => ph.status === "active") ?? null;

  // Buchbar – nur in der aktiven Phase; geplante (gebuchte) Einheiten zählen schon mit.
  const bookable: BookableOption[] = [];
  const remainingOf = (c: Counter) => (c.target === null ? null : c.target - c.done - c.planned);
  if (current) {
    if (["einstieg", "schalter", "uebung", "wiederholung"].includes(current.id)) {
      const c = current.counters[0];
      const rem = remainingOf(c);
      const sizes = sizesFor(rem);
      if (sizes.length) bookable.push({ kind: c.kind, sizes, remaining: rem });
    } else if (current.id === "testfahrt") {
      if (!plannedOf(records, "testfahrt")) bookable.push({ kind: "testfahrt", sizes: [1], remaining: 1 });
    } else if (current.id === "sonder") {
      const [ue, ab, be] = current.counters;
      // Einstieg: je ein 90-Min-Block Überland und Autobahn (auch gebuchte zählen, damit man beide planen kann)
      const introBlock = (k: DriveKind) => records.some((r) => r.kind === k && r.units >= 2 && (r.status === "done" || r.status === "planned"));
      const introDone = hasDoubleBlock(records, "ueberland") && hasDoubleBlock(records, "autobahn");
      for (const c of [ue, ab]) {
        const rem = remainingOf(c)!;
        if (rem <= 0) continue;
        if (!introDone && !introBlock(c.kind)) { if (rem >= 2) bookable.push({ kind: c.kind, sizes: [2], remaining: rem }); }
        else if (introDone) bookable.push({ kind: c.kind, sizes: rem >= 2 ? [1, 2] : [1], remaining: rem });
      }
      const remBe = remainingOf(be)!;
      if (introDone && remBe > 0) bookable.push({ kind: "beleuchtung", sizes: remBe >= 2 ? [1, 2] : [1], remaining: remBe });
    }
  }

  // Gesamtfortschritt: Anteil erledigter Einheiten über alle Zähler mit Ziel
  let doneU = 0, totalU = 0;
  for (const ph of phases) for (const c of ph.counters) {
    if (c.target === null) { totalU += Math.max(c.done, 1); doneU += 0; continue; }
    totalU += c.target; doneU += Math.min(c.done, c.target);
  }
  const percent = totalU ? Math.round((doneU / totalU) * 100) : 0;

  return { phases, current, bookable, next: nextText(current, bookable, p), percent };
}

function nextText(current: Phase | null, bookable: BookableOption[], p: TrainingProfile): string {
  if (!current) return "Alles erledigt – viel Erfolg!";
  if (current.id === "reife") return "Dein Fahrlehrer prüft, ob du bereit für die Prüfung bist.";
  if (current.id === "pruefung") {
    if (!p.theoryPassedAt) return "Nächster Schritt: Theorieprüfung bestehen.";
    if (!p.pruefauftragAt) return "Wir warten auf den Prüfauftrag der Führerscheinstelle.";
    return "Du bekommst eine Einladung zur Prüfung, sobald der TÜV-Termin feststeht.";
  }
  if (current.id === "testfahrt" && !bookable.length) return "Deine Testfahrt ist gebucht.";
  if (current.id === "uebung" && current.counters[0].target === null) return "Buche Übungsfahrten – dein Fahrlehrer legt fest, wie viele du brauchst.";
  if (!bookable.length) return `${current.title}: alles gebucht – jetzt fahren!`;
  return `Als Nächstes: ${bookable.map((b) => KIND_LABEL[b.kind]).join(", ")}`;
}

/** Prüft eine konkrete Buchung (Art + Anzahl Einheiten) gegen den Ausbildungsstand. */
export function canBook(state: TrainingState, kind: DriveKind, units: number): { ok: true } | { ok: false; reason: string } {
  const opt = state.bookable.find((b) => b.kind === kind);
  if (!opt) return { ok: false, reason: `${KIND_LABEL[kind]} ist für dich gerade nicht buchbar. ${state.next}` };
  if (!opt.sizes.includes(units)) {
    return { ok: false, reason: opt.sizes.includes(2) ? "Bitte buche 90 Minuten (2 Stunden am Stück)." : "Für dich ist nur noch eine einzelne Stunde (45 Min) offen." };
  }
  return { ok: true };
}
