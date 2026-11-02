import { auditRequest } from "@/lib/server/audit-context";
import { currentUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { exportPersonalData } from "@/lib/server/repo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** DSGVO-Auskunft (Art. 15): alle gespeicherten Daten eines Schülers als JSON. */
export async function GET(_req: Request, ctx: { params: Promise<{ userId: string }> }) {
  void auditRequest(_req, "GET /api/admin/students/[userId]/export");
  const user = await currentUser();
  if (!user || user.role !== "teacher") return new Response("Nur für Lehrkräfte", { status: 403 });
  const { userId } = await ctx.params;
  const data = exportPersonalData(db(), userId);
  if (!data) return new Response("Nicht gefunden", { status: 404 });
  const name = `auskunft-${data.account.name.replace(/[^\p{L}\p{N}]+/gu, "-").toLowerCase()}-${data.exportedAt.slice(0, 10)}.json`;
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(name)}"`,
      "Cache-Control": "no-store",
    },
  });
}
