import { requireTeacher } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { listReceipts, PAYMENTS, RECEIPT_CATEGORIES } from "@/lib/server/receipts";
import { deleteReceiptAction, updateReceiptAction } from "@/app/receipt-actions";
import { formatPrice } from "@/lib/language-package";
import { addDays, dayKey, fmtDate } from "@/lib/time";
import { ReceiptUpload } from "./ReceiptUpload";

export const dynamic = "force-dynamic";
export const metadata = { title: "Belege" };

const isDay = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
const de = (d: string) => d.split("-").reverse().join(".");

function presets(today: string) {
  const [y, m] = today.split("-").map(Number);
  const first = (yy: number, mm: number) => `${yy}-${String(mm).padStart(2, "0")}-01`;
  const lastOf = (yy: number, mm: number) => addDays(mm === 12 ? first(yy + 1, 1) : first(yy, mm + 1), -1);
  const pm = m === 1 ? [y - 1, 12] : [y, m - 1];
  const q = Math.floor((m - 1) / 3), pq = q === 0 ? [y - 1, 3] : [y, q - 1];
  return [
    { label: "Dieser Monat", from: first(y, m), to: lastOf(y, m) },
    { label: "Letzter Monat", from: first(pm[0], pm[1]), to: lastOf(pm[0], pm[1]) },
    { label: "Letztes Quartal", from: first(pq[0], pq[1] * 3 + 1), to: lastOf(pq[0], pq[1] * 3 + 3) },
    { label: `Jahr ${y}`, from: `${y}-01-01`, to: `${y}-12-31` },
    { label: `Jahr ${y - 1}`, from: `${y - 1}-01-01`, to: `${y - 1}-12-31` },
  ];
}

export default async function ReceiptsPage({ searchParams }: { searchParams: Promise<{ von?: string; bis?: string; nur?: string }> }) {
  await requireTeacher();
  const sp = await searchParams;
  const today = dayKey(Date.now());
  const ps = presets(today);
  const from = isDay(sp.von) ? sp.von! : ps[0].from;
  const to = isDay(sp.bis) ? sp.bis! : ps[0].to;
  const onlyNew = sp.nur === "neu";
  const list = listReceipts(db(), from, to, onlyNew);
  const sum = list.reduce((a, r) => a + (r.amountCents ?? 0), 0);
  const fresh = list.filter((r) => !r.exportedAt).length;
  const q = (p: { from: string; to: string }) => `/verwaltung/belege?von=${p.from}&bis=${p.to}${onlyNew ? "&nur=neu" : ""}`;

  return (
    <>
      <h1>Belege</h1>
      <p className="page-intro">Ausgabe gehabt? Beleg sofort fotografieren – fertig. Am Monatsende den Zeitraum wählen und alles für den Steuerberater exportieren.</p>

      <section className="card card-accent">
        <h2>Neuer Beleg</h2>
        <ReceiptUpload today={today} categories={RECEIPT_CATEGORIES} payments={PAYMENTS} />
      </section>

      <section className="card">
        <h2>Zeitraum</h2>
        <div className="chip-row">
          {ps.map((p) => <a key={p.label} className={`chip ${p.from === from && p.to === to ? "on" : ""}`} href={q(p)}>{p.label}</a>)}
        </div>
        <form method="get" className="row receipt-range">
          <div className="field" style={{ margin: 0 }}><label htmlFor="von">von</label><input id="von" type="date" name="von" defaultValue={from} /></div>
          <div className="field" style={{ margin: 0 }}><label htmlFor="bis">bis</label><input id="bis" type="date" name="bis" defaultValue={to} /></div>
          <label className="check" style={{ alignSelf: "end" }}><input type="checkbox" name="nur" value="neu" defaultChecked={onlyNew} /><span>nur noch nicht exportierte</span></label>
          <button className="btn btn-secondary btn-small" type="submit" style={{ alignSelf: "end" }}>Anzeigen</button>
        </form>
        <div className="receipt-sum">
          <span><strong>{list.length}</strong> Belege · {de(from)} – {de(to)}</span>
          <span>Summe <strong>{formatPrice(sum)}</strong></span>
          <span>{fresh} noch nicht exportiert</span>
        </div>
        <form action="/api/belege/export" method="post" className="row">
          <input type="hidden" name="from" value={from} /><input type="hidden" name="to" value={to} />
          <label className="check"><input type="checkbox" name="nur" value="neu" defaultChecked /><span>nur noch nicht exportierte</span></label>
          <button className="btn btn-gold" type="submit" disabled={list.length === 0}>⬇ Exportieren (einzelne Dateien als ZIP)</button>
        </form>
        <p className="hint">Im ZIP liegt jeder Beleg als eigene Datei (z. B. „2026-11-03_Shell_45-90EUR_Kraftstoff.jpg“) und eine Übersicht als Tabelle für Excel.
          Danach sind die Belege mit „exportiert am …“ markiert. Seite nach dem Export einmal neu laden.</p>
      </section>

      <section className="card">
        <h2>Belege im Zeitraum</h2>
        {list.length === 0 ? <p className="hint">Keine Belege in diesem Zeitraum.</p> : (
          <ul className="receipt-list">
            {list.map((r) => (
              <li key={r.id}>
                <a className="receipt-thumb" href={`/api/belege/datei/${r.id}`} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {r.fileType.startsWith("image/") && !/heic|heif/.test(r.fileType) ? <img src={`/api/belege/datei/${r.id}`} alt="" loading="lazy" /> : <span className="receipt-pdf">{r.fileType.includes("pdf") ? "PDF" : "Foto"}</span>}
                </a>
                <div className="receipt-info">
                  <strong>{r.supplier || "Beleg"}</strong>
                  <span>{de(r.day)} · {RECEIPT_CATEGORIES[r.category]}{r.payment ? ` · ${PAYMENTS[r.payment as keyof typeof PAYMENTS] ?? ""}` : ""}</span>
                  {r.note && <span className="hint">{r.note}</span>}
                  {r.exportedAt ? <span className="badge badge-ok">exportiert am {fmtDate(r.exportedAt)}</span> : <span className="badge badge-warn">noch nicht exportiert</span>}
                </div>
                <div className="receipt-amt">{r.amountCents !== null ? formatPrice(r.amountCents) : "–"}</div>
                <details className="receipt-edit">
                  <summary className="link-btn">ändern</summary>
                  <form action={updateReceiptAction} className="akte-form">
                    <input type="hidden" name="id" value={r.id} />
                    <div className="receipt-fields">
                      <input type="date" name="day" defaultValue={r.day} aria-label="Datum" />
                      <input name="amount" defaultValue={r.amountCents !== null ? (r.amountCents / 100).toFixed(2).replace(".", ",") : ""} aria-label="Betrag" placeholder="Betrag" />
                      <input name="supplier" defaultValue={r.supplier} aria-label="Firma" placeholder="Firma" />
                      <select name="category" defaultValue={r.category} aria-label="Kategorie">{Object.entries(RECEIPT_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                      <select name="payment" defaultValue={r.payment} aria-label="Bezahlt mit"><option value="">–</option>{Object.entries(PAYMENTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                      <select name="vat" defaultValue={r.vatRate ?? ""} aria-label="MwSt"><option value="">MwSt ?</option><option value="19">19 %</option><option value="7">7 %</option><option value="0">0 %</option></select>
                    </div>
                    <input name="note" defaultValue={r.note} aria-label="Notiz" placeholder="Notiz" />
                    <div className="row">
                      <button className="btn btn-small" type="submit">Speichern</button>
                      <a className="btn btn-secondary btn-small" href={`/api/belege/datei/${r.id}?download`}>Herunterladen</a>
                    </div>
                  </form>
                  <form action={deleteReceiptAction}><input type="hidden" name="id" value={r.id} /><button className="link-btn danger" type="submit">Beleg löschen</button></form>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
