import { currentUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { getReceipt } from "@/lib/server/receipts";
import { readUpload } from "@/lib/server/uploads";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  const r = getReceipt(db(), (await params).id);
  if (!user || user.role !== "teacher" || !r) return new Response("Nicht gefunden", { status: 404 });
  const data = readUpload(r.filePath);
  if (!data) return new Response("Datei fehlt", { status: 404 });
  const download = new URL(req.url).searchParams.has("download");
  return new Response(new Uint8Array(data), {
    headers: {
      "content-type": r.fileType, "cache-control": "private, max-age=3600", "x-content-type-options": "nosniff",
      "content-disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(r.fileName)}`,
    },
  });
}
