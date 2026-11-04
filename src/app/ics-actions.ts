"use server";

import { auditAction } from "@/lib/server/audit-context";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/server/db";
import { requireTeacher } from "@/lib/server/auth";
import { newIcsToken } from "@/lib/server/ics";

export async function createIcsTokenAction(): Promise<void> {
  await auditAction("ics-actions:createIcsTokenAction", []);
  await requireTeacher();
  newIcsToken(db());
  revalidatePath("/verwaltung/kalender");
}
