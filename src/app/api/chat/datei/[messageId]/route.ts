import { auditRequest } from "@/lib/server/audit-context";
import { currentUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { getMessage } from "@/lib/server/chat";
import { readUpload } from "@/lib/server/uploads";

/** Anhang anzeigen – nur für den Schüler des Gesprächs und die Fahrschule. */
export async function GET(_req: Request, { params }: { params: Promise<{ messageId: string }> }) {
  void auditRequest(_req, "GET /api/chat/datei/[messageId]");
  const user = await currentUser();
  const m = getMessage(db(), (await params).messageId);
  if (!user || !m?.filePath || !m.file || (user.role !== "teacher" && user.id !== m.studentId)) return new Response("Nicht gefunden", { status: 404 });
  const data = readUpload(m.filePath);
  if (!data) return new Response("Nicht gefunden", { status: 404 });
  return new Response(new Uint8Array(data), {
    headers: {
      "content-type": m.file.type, "cache-control": "private, max-age=3600",
      "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(m.file.name)}`,
      "x-content-type-options": "nosniff",
    },
  });
}
