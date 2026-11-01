import Link from "next/link";
import { requireTeacher } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { filterMoney, moneyEntries, MONEY_CATEGORY_LABEL, PROVIDER_LABEL, sumMoney } from "@/lib/server/finance";
import { parseFinance, type FinanceParams } from "@/lib/server/finance-query";
import { formatPrice } from "@/lib/language-package";
import { fmtDayShort, fmtTime } from "@/lib/time";
import { PageHead } from "@/components/PageHead";

export const dynamic = "force-dynamic";
export const metadata = { title: "Finanzen" };

const fmtD = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "2-digit" });

export default async function FinancePage({ searchParams }: { searchParams: Promise<FinanceParams> }) {
  await requireTeacher();
  const p = await searchParams;
  const { filter, zeit, label } = parseFinance(p);
  const all = moneyEntries(db());
  const list = filterMoney(all, filter);
  const sum = sumMoney(list);
  const students = db().prepare(`SELECT id, name FROM users WHERE role = 'student' ORDER BY name`).all() as Array<{ id: string; name: string }>;
  const providers = [...new Set(all.map((e) => e.provider).filter(Boolean))];
  const qs = new URLSearchParams(Object.entries(p).filter(([, v]) => typeof v === "string" && v) as Array<[string, string]>).toString();
  const tab = (art: string, text: string) => {
    const q = new URLSearchParams(qs); q.set("art", art); if (art === "offen") q.delete("zeit");
    return <Link href={`/verwaltung/finanzen?${q}`} className={`fin-tab ${filter.kind === art ? "on" : ""}`}>{text}</Link>;
  };
  const now = Date.now();

  return (
    <>
      <PageHead title="Finanzen" intro="Alle Einnahmen und offenen Zahlungen. Filter oben wählen – unten steht immer die Summe." />
      <div className="fin-tabs">{tab("einnahme", "Einnahmen")}{tab("offen", "Offene Zahlungen")}{tab("alle", "Alles")}</div>

      <form className="card fin-filter" method="get">
        <input type="hidden" name="art" value={filter.kind} />
        <div className="field"><label htmlFor="f-zeit">Zeitraum</label>
          <select id="f-zeit" name="zeit" defaultValue={zeit}>
            <option value="monat">Dieser Monat</option><option value="vormonat">Letzter Monat</option><option value="jahr">Dieses Jahr</option>
            <option value="alle">Alles</option><option value="eigen">Eigener Zeitraum …</option>
          </select></div>
        <div className="field"><label htmlFor="f-von">von</label><input id="f-von" type="date" name="von" defaultValue={p.von} /></div>
        <div className="field"><label htmlFor="f-bis">bis</label><input id="f-bis" type="date" name="bis" defaultValue={p.bis} /></div>
        <div className="field"><label htmlFor="f-ber">Bereich</label>
          <select id="f-ber" name="bereich" defaultValue={filter.category ?? ""}>
            <option value="">alle</option>
            {Object.entries(MONEY_CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select></div>
        <div className="field"><label htmlFor="f-za">Zahlungsart</label>
          <select id="f-za" name="zahlart" defaultValue={filter.provider ?? ""}>
            <option value="">alle</option>
            {providers.map((k) => <option key={k} value={k}>{PROVIDER_LABEL[k] ?? k}</option>)}
          </select></div>
        <div className="field"><label htmlFor="f-s">Schüler</label>
          <select id="f-s" name="schueler" defaultValue={filter.userId ?? ""}>
            <option value="">alle</option>
            {students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select></div>
        <div className="field fin-q"><label htmlFor="f-q">Suche</label><input id="f-q" name="q" defaultValue={p.q} placeholder="Name oder Leistung" /></div>
        <div className="row fin-btns">
          <button className="btn btn-small" type="submit">Anzeigen</button>
          <Link className="link-btn" href={`/verwaltung/finanzen?art=${filter.kind}`}>zurücksetzen</Link>
        </div>
        <p className="hint" style={{ gridColumn: "1 / -1", margin: 0 }}>„von/bis“ gilt, wenn bei Zeitraum „Eigener Zeitraum“ gewählt ist.</p>
      </form>

      <div className="fin-sum">
        <div><small>{filter.kind === "offen" ? "Offen" : filter.kind === "alle" ? "Summe" : "Einnahmen"} · {label}</small><strong>{formatPrice(sum.school)}</strong><em>Fahrschule</em></div>
        <div><small>TÜV (weiterleiten)</small><strong>{formatPrice(sum.tuev)}</strong><em>durchlaufend</em></div>
        <div><small>Gesamt</small><strong>{formatPrice(sum.total)}</strong><em>{sum.count} {sum.count === 1 ? "Eintrag" : "Einträge"}</em></div>
        <a className="btn btn-secondary btn-small fin-csv" href={`/api/finanzen/export?${qs}`}>Als Excel-Liste (CSV)</a>
      </div>

      <div className="card fin-list">
        {list.length === 0 ? <p className="hint">Keine Einträge für diese Auswahl.</p> : (
          <table>
            <thead><tr><th>Datum</th><th>Schüler</th><th>Leistung</th><th>Zahlungsart</th><th className="num">Betrag</th></tr></thead>
            <tbody>
              {list.map((e) => (
                <tr key={`${e.kind}-${e.id}`} className={e.kind === "offen" ? "is-open" : e.totalCents < 0 ? "is-neg" : ""}>
                  <td>{fmtD.format(e.at)}{e.kind === "offen" && e.deadline && <small className={e.deadline < now ? "late" : ""}>fällig {fmtDayShort(e.deadline)} {fmtTime(e.deadline)}</small>}</td>
                  <td><Link href={`/verwaltung/schueler/${e.userId}`}>{e.userName}</Link></td>
                  <td>{e.title}<small>{MONEY_CATEGORY_LABEL[e.category]}</small></td>
                  <td>{e.kind === "offen" ? <span className="badge badge-warn">offen</span> : PROVIDER_LABEL[e.provider] ?? e.provider}</td>
                  <td className="num">{formatPrice(e.totalCents)}{e.tuevCents > 0 && <small>davon TÜV {formatPrice(e.tuevCents)}</small>}</td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr><td colSpan={4}>Summe ({sum.count})</td><td className="num">{formatPrice(sum.total)}</td></tr></tfoot>
          </table>
        )}
      </div>
    </>
  );
}
