import { auditRequest } from "@/lib/server/audit-context";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { getUser } from "@/lib/server/repo";
import { addDoc, isDocType } from "@/lib/server/student-docs";
import { storeUpload, UploadError } from "@/lib/server/uploads";

/** Unterlagen hochladen – Schüler für sich selbst, die Fahrschule auch für einen Schüler. Bis zu 4 Dateien auf einmal. */
export async function POST(req: Request) {
  void auditRequest(req, "POST /api/unterlagen");
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: "Bitte einloggen." }, { status: 401 });
  const f = await req.formData();
  const userId = String(f.get("userId") ?? "") || me.id;
  if (userId !== me.id && me.role !== "teacher") return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 });
  const target = getUser(db(), userId);
  if (!target || target.role !== "student") return NextResponse.json({ error: "Schüler nicht gefunden." }, { status: 404 });
  const type = String(f.get("type") ?? "");
  if (!isDocType(type)) return NextResponse.json({ error: "Unbekannte Unterlage." }, { status: 400 });
  const files = f.getAll("files").filter((x): x is File => x instanceof File && x.size > 0).slice(0, 4);
  if (!files.length) return NextResponse.json({ error: "Bitte eine Datei wählen." }, { status: 400 });
  try {
    for (const file of files) {
      const s = await storeUpload(file, "unterlagen");
      addDoc(db(), { userId, type, path: s.path, name: s.name, fileType: s.type, size: s.size });
    }
  } catch (e) {
    if (e instanceof UploadError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[unterlagen]", (e as Error).message);
    return NextResponse.json({ error: "Hochladen hat nicht geklappt." }, { status: 500 });
  }
  revalidatePath("/konto");
  revalidatePath(`/verwaltung/schueler/${userId}`);
  return NextResponse.json({ ok: true });
}
