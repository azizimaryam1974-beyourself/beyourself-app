import { NextResponse } from "next/server";
import { currentUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { clearForStudent } from "@/lib/server/chat";

/** Schüler leert den Chat für sich – bei der Fahrschule bleibt alles erhalten. */
export async function POST(_req: Request, { params }: { params: Promise<{ studentId: string }> }) {
  const user = await currentUser();
  const { studentId } = await params;
  if (!user || user.id !== studentId) return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  clearForStudent(db(), studentId);
  return NextResponse.json({ ok: true });
}
