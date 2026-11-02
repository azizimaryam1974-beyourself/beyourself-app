import { auditRequest } from "@/lib/server/audit-context";
import { requireTeacher } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { filterMoney, moneyCsv, moneyEntries } from "@/lib/server/finance";
import { parseFinance } from "@/lib/server/finance-query";

/** Die gefilterte Liste als CSV (öffnet in Excel/Numbers) – z. B. für die Steuerberatung. */
export async function GET(req: Request) {
  void auditRequest(req, "GET /api/finanzen/export");
  await requireTeacher();
  const p = Object.fromEntries(new URL(req.url).searchParams.entries());
  const { filter } = parseFinance(p);
  const csv = moneyCsv(filterMoney(moneyEntries(db()), filter));
  return new Response(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="finanzen-${new Date().toISOString().slice(0, 10)}.csv"`, "cache-control": "no-store" } });
}
