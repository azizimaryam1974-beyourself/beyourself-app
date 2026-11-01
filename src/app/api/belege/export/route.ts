import { currentUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { exportName, listReceipts, markExported, receiptsCsv } from "@/lib/server/receipts";
import { readUpload } from "@/lib/server/uploads";
import { makeZip } from "@/lib/server/zip";

/**
 * Export für den Steuerberater: ZIP mit jedem Beleg als eigene Datei + Übersicht (CSV für Excel).
 * Alle exportierten Belege werden mit dem Export-Datum markiert.
 */
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user || user.role !== "teacher") return new Response("Kein Zugriff", { status: 403 });
  const f = await req.formData();
  const from = String(f.get("from") ?? ""), to = String(f.get("to") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return new Response("Zeitraum fehlt", { status: 400 });
  const list = listReceipts(db(), from, to, f.get("nur") === "neu");
  if (!list.length) return new Response("Keine Belege in diesem Zeitraum.", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  const files = list.flatMap((r) => { const d = readUpload(r.filePath); return d ? [{ name: exportName(r), data: new Uint8Array(d) }] : []; });
  const label = `${from}_bis_${to}`;
  files.push({ name: `Uebersicht_Belege_${label}.csv`, data: new Uint8Array(Buffer.from(receiptsCsv(list), "utf8")) });
  const zip = makeZip(files);
  markExported(db(), list.map((r) => r.id));
  return new Response(new Uint8Array(zip), {
    headers: { "content-type": "application/zip", "content-disposition": `attachment; filename="Belege_beyourself_${label}.zip"`, "cache-control": "no-store" },
  });
}
