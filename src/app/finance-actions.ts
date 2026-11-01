"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/server/db";
import { requireTeacher } from "@/lib/server/auth";
import { saveBankDetails } from "@/lib/server/finance";

export async function saveBankAction(form: FormData): Promise<void> {
  await requireTeacher();
  saveBankDetails(db(), String(form.get("bank") ?? ""));
  revalidatePath("/verwaltung/einstellungen/regeln");
  revalidatePath("/termine");
}
