"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/server/db";
import { requireTeacher } from "@/lib/server/auth";
import { CATALOG } from "@/lib/catalog";

export interface ActionState { ok?: string; error?: string }

/** "68" / "68,00" / "129,83 €" → Cent */
function euro(s: string): number {
  const m = /^(\d{1,5})(?:[.,](\d{1,2}))?$/.exec(s.replace(/[€\s]/g, ""));
  return m ? Number(m[1]) * 100 + Number((m[2] ?? "0").padEnd(2, "0")) : NaN;
}

export async function savePriceAction(_p: ActionState, form: FormData): Promise<ActionState> {
  await requireTeacher();
  const item = CATALOG[Number(form.get("item"))];
  if (!item) return { error: "Position nicht gefunden." };
  const prices = item.ids.map((_, i) => euro(String(form.get(`price${i}`) ?? "")));
  if (prices.some((p) => !Number.isFinite(p) || p <= 0)) return { error: "Bitte jeden Preis als Zahl eintragen, z. B. 68 oder 129,83." };
  const description = String(form.get("description") ?? "").split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 12).join("\n").slice(0, 1500);
  const d = db();
  d.transaction(() => {
    item.ids.forEach((id, i) => d.prepare(`UPDATE offers SET price_cents = ? WHERE id = ?`).run(prices[i], id));
    d.prepare(`UPDATE offers SET description = ? WHERE id = ?`).run(description, item.ids[0]);
  })();
  revalidatePath("/verwaltung", "layout");
  revalidatePath("/termine");
  return { ok: "Gespeichert. Neue Buchungen nutzen ab sofort den neuen Preis; schon gebuchte Fahrten behalten ihren Preis." };
}

export async function setTestfahrtAction(form: FormData): Promise<void> {
  await requireTeacher();
  const m = String(form.get("minutes")) === "45" ? "45" : "30";
  db().prepare(`INSERT INTO settings (key,value) VALUES ('testfahrt_minutes', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(m);
  revalidatePath("/verwaltung", "layout");
}
