"use server";

import { auditAction } from "@/lib/server/audit-context";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/server/db";
import { requireUser } from "@/lib/server/auth";
import { getUser } from "@/lib/server/repo";
import { saveDetails, setPhone, validateDetails, type DetailsErrors } from "@/lib/server/user-details";

export interface DetailsState { ok?: boolean; errors?: DetailsErrors; values?: Record<string, string> }

/** Persönliche Angaben speichern – Schüler für sich selbst, die Fahrschule für jeden Schüler. */
export async function saveDetailsAction(_prev: DetailsState, form: FormData): Promise<DetailsState> {
  await auditAction("details-actions:saveDetailsAction", [_prev, form]);
  const me = await requireUser();
  const target = String(form.get("userId") ?? "") || me.id;
  if (target !== me.id && me.role !== "teacher") return { errors: { birthday: "Keine Berechtigung." } };
  if (!getUser(db(), target)) return { errors: { birthday: "Schüler nicht gefunden." } };
  const s = (k: string) => String(form.get(k) ?? "").trim();
  const v = { birthday: s("birthday"), street: s("street"), zip: s("zip"), city: s("city"), phone: s("phone") };
  const errors = validateDetails(v);
  if (Object.keys(errors).length) return { errors, values: v };
  const d = db();
  d.transaction(() => { saveDetails(d, target, v); setPhone(d, target, v.phone); })();
  revalidatePath("/konto");
  revalidatePath(`/verwaltung/schueler/${target}`);
  revalidatePath("/verwaltung/nachrichten");
  return { ok: true, values: v };
}
