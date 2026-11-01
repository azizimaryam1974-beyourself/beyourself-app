"use server";

import { revalidatePath } from "next/cache";
import { requireTeacher } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { deleteReceipt, updateReceipt } from "@/lib/server/receipts";
import { deleteUpload } from "@/lib/server/uploads";

const s = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

export async function updateReceiptAction(form: FormData): Promise<void> {
  await requireTeacher();
  const m = /^(\d{1,6})(?:[.,](\d{1,2}))?$/.exec(s(form, "amount").replace(/[€\s]/g, ""));
  updateReceipt(db(), s(form, "id"), {
    day: /^\d{4}-\d{2}-\d{2}$/.test(s(form, "day")) ? s(form, "day") : undefined,
    amountCents: m ? Number(m[1]) * 100 + Number((m[2] ?? "0").padEnd(2, "0")) : null,
    vatRate: s(form, "vat") === "" ? null : Number(s(form, "vat")),
    supplier: s(form, "supplier"), category: s(form, "category") as never, payment: s(form, "payment"), note: s(form, "note"),
  });
  revalidatePath("/verwaltung/belege");
}

export async function deleteReceiptAction(form: FormData): Promise<void> {
  await requireTeacher();
  const r = deleteReceipt(db(), s(form, "id"));
  if (r) deleteUpload(r.filePath);
  revalidatePath("/verwaltung/belege");
}
