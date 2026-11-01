import { currentUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { getUser } from "@/lib/server/repo";
import { getDetails } from "@/lib/server/user-details";
import { readUpload } from "@/lib/server/uploads";

/** Profilfoto: sieht man selbst, die Fahrschule sieht alle, Schüler sehen das Foto der Fahrschule. */
export async function GET(_req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const viewer = await currentUser();
  const { userId } = await params;
  const target = getUser(db(), userId);
  if (!viewer || !target || !(viewer.id === userId || viewer.role === "teacher" || target.role === "teacher")) return new Response("Nicht gefunden", { status: 404 });
  const d = getDetails(db(), userId);
  const data = d.photoPath ? readUpload(d.photoPath) : null;
  if (!data) return new Response("Nicht gefunden", { status: 404 });
  const ext = d.photoPath!.split(".").pop();
  return new Response(new Uint8Array(data), {
    headers: { "content-type": ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg", "cache-control": "private, max-age=86400", "x-content-type-options": "nosniff" },
  });
}
