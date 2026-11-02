import { auditRequest } from "@/lib/server/audit-context";
import { NextResponse } from "next/server";
import { currentUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { setPhoto } from "@/lib/server/user-details";
import { deleteUpload, storeUpload, UploadError } from "@/lib/server/uploads";

/** Eigenes Profilfoto hochladen (wird im Browser schon verkleinert) oder entfernen. */
export async function POST(req: Request) {
  void auditRequest(req, "POST /api/profilbild");
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Bitte einloggen." }, { status: 401 });
  const f = await req.formData();
  try {
    if (f.get("remove") === "1") {
      const old = setPhoto(db(), user.id, null);
      if (old) deleteUpload(old);
      return NextResponse.json({ ok: true });
    }
    const file = f.get("file");
    if (!(file instanceof File) || !file.type.startsWith("image/")) return NextResponse.json({ error: "Bitte ein Foto wählen." }, { status: 400 });
    const stored = await storeUpload(file, "avatars");
    const old = setPhoto(db(), user.id, stored.path);
    if (old) deleteUpload(old);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof UploadError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[profilbild]", (e as Error).message);
    return NextResponse.json({ error: "Hochladen hat nicht geklappt." }, { status: 500 });
  }
}
