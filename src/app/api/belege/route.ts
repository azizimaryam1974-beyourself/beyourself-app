import { NextResponse } from "next/server";
import { currentUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { addReceipt } from "@/lib/server/receipts";
import { storeUpload, UploadError } from "@/lib/server/uploads";

/** Beleg hochladen (Foto vom Handy oder PDF) – nur die Fahrschule. */
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user || user.role !== "teacher") return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  const f = await req.formData();
  const s = (k: string) => String(f.get(k) ?? "").trim();
  const day = /^\d{4}-\d{2}-\d{2}$/.test(s("day")) ? s("day") : new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(Date.now());
  const m = /^(\d{1,6})(?:[.,](\d{1,2}))?$/.exec(s("amount").replace(/[€\s]/g, ""));
  const amountCents = m ? Number(m[1]) * 100 + Number((m[2] ?? "0").padEnd(2, "0")) : null;
  const vat = s("vat") === "" ? null : Number(s("vat"));
  try {
    const file = f.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Bitte ein Foto aufnehmen oder eine Datei wählen." }, { status: 400 });
    const stored = await storeUpload(file, "belege");
    const r = addReceipt(db(), { day, amountCents, vatRate: Number.isFinite(vat) ? vat : null, supplier: s("supplier"), category: s("category"), payment: s("payment"), note: s("note"), file: stored, createdBy: user.id });
    return NextResponse.json({ receipt: r });
  } catch (e) {
    if (e instanceof UploadError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[belege]", (e as Error).message);
    return NextResponse.json({ error: "Speichern hat nicht geklappt. Bitte noch einmal." }, { status: 500 });
  }
}
