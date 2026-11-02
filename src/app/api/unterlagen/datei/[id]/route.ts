import { auditRequest } from "@/lib/server/audit-context";
import { currentUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { getDoc } from "@/lib/server/student-docs";
import { readUpload } from "@/lib/server/uploads";

/** Unterlage ansehen: nur der Schüler selbst und die Fahrschule. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  void auditRequest(_req, "GET /api/unterlagen/datei/[id]");
  const me = await currentUser();
  const { id } = await params;
  const doc = getDoc(db(), id);
  if (!me || !doc || (doc.userId !== me.id && me.role !== "teacher")) return new Response("Nicht gefunden", { status: 404 });
  const data = readUpload(doc.path);
  if (!data) return new Response("Nicht gefunden", { status: 404 });
  return new Response(new Uint8Array(data), {
    headers: {
      "content-type": doc.fileType, "cache-control": "private, no-store", "x-content-type-options": "nosniff",
      "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(doc.name)}`,
    },
  });
}
