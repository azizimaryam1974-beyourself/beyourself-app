import { requireTeacher } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { auditCsv, listAudit } from "@/lib/server/audit";
import { audit } from "@/lib/server/audit-context";
import { parseAudit } from "@/lib/server/audit-query";

export async function GET(req: Request) {
  await requireTeacher();
  const p = Object.fromEntries(new URL(req.url).searchParams.entries());
  const f = parseAudit(p);
  const { rows } = listAudit(db(), { ...f, limit: 100_000, offset: 0 });
  await audit("api", "Protokoll exportiert", { details: { filter: p, zeilen: rows.length } });
  return new Response(auditCsv(rows), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="protokoll-${new Date().toISOString().slice(0, 10)}.csv"`, "cache-control": "no-store" } });
}
