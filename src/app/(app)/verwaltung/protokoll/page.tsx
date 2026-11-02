import Link from "next/link";
import { requireTeacher } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { listAudit, verifyAudit } from "@/lib/server/audit";
import { parseAudit, type AuditParams } from "@/lib/server/audit-query";
import { PageHead } from "@/components/PageHead";

export const dynamic = "force-dynamic";
export const metadata = { title: "Protokoll" };

const KIND: Record<string, string> = { auth: "Anmeldung", action: "Aktion", api: "Datei/Zahlung/App", page: "Seite geöffnet", error: "Fehler", system: "System", payment: "Zahlung" };
const fmt = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });

export default async function AuditPage({ searchParams }: { searchParams: Promise<AuditParams> }) {
  await requireTeacher();
  const p = await searchParams;
  const f = parseAudit(p);
  const { rows, total } = listAudit(db(), f);
  const chain = verifyAudit(db());
  const people = db().prepare(`SELECT id, name, role FROM users ORDER BY role DESC, name`).all() as Array<{ id: string; name: string; role: string }>;
  const qs = new URLSearchParams(Object.entries(p).filter(([k, v]) => k !== "seite" && typeof v === "string" && v) as Array<[string, string]>).toString();
  const pages = Math.ceil(total / 200);

  return (
    <>
      <PageHead title="Protokoll" back={{ href: "/verwaltung/einstellungen", label: "Einstellungen" }}
        intro="Hier wird im Hintergrund alles aufgezeichnet: wer sich wann eingeloggt hat, wer welche Seite geöffnet, was gebucht, bezahlt, geändert oder hochgeladen wurde – und jeder Fehler. Passwörter und Schlüssel werden nie gespeichert." />
      <div className={`alert ${chain.brokenAt ? "alert-error" : "alert-ok"}`} role="status">
        {chain.brokenAt
          ? <><strong>Achtung:</strong> Das Protokoll wurde ab Eintrag Nr. {chain.brokenAt} nachträglich verändert oder Einträge fehlen. Bitte Claude Bescheid geben.</>
          : <>Protokoll unverändert ✓ – {chain.checked.toLocaleString("de-DE")} Einträge geprüft. Jeder Eintrag ist mit dem vorherigen verkettet, nachträgliche Änderungen würden auffallen.</>}
      </div>
      <form className="card fin-filter" method="get">
        <div className="field"><label htmlFor="a-z">Zeitraum</label>
          <select id="a-z" name="zeit" defaultValue={f.zeit}>
            <option value="heute">Heute</option><option value="7">Letzte 7 Tage</option><option value="30">Letzte 30 Tage</option><option value="365">Letztes Jahr</option><option value="alle">Alles</option>
          </select></div>
        <div className="field"><label htmlFor="a-art">Art</label>
          <select id="a-art" name="art" defaultValue={p.art ?? ""}>
            <option value="">alle</option>{Object.entries(KIND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select></div>
        <div className="field"><label htmlFor="a-wer">Person</label>
          <select id="a-wer" name="wer" defaultValue={p.wer ?? ""}>
            <option value="">alle</option>{people.map((u) => <option key={u.id} value={u.id}>{u.name}{u.role === "teacher" ? " (Fahrschule)" : ""}</option>)}
          </select></div>
        <div className="field fin-q"><label htmlFor="a-q">Suche</label><input id="a-q" name="q" defaultValue={p.q} placeholder="z. B. Login, IP, Buchung" /></div>
        <label className="check" style={{ alignSelf: "center" }}><input type="checkbox" name="fehler" value="1" defaultChecked={p.fehler === "1"} /> <span>nur Fehler/Fehlversuche</span></label>
        <div className="row fin-btns">
          <button className="btn btn-small" type="submit">Anzeigen</button>
          <a className="link-btn" href={`/api/protokoll/export?${qs}`}>Als Excel-Liste (CSV)</a>
        </div>
      </form>
      <p className="hint" style={{ color: "rgba(246,240,230,.75)" }}>{total.toLocaleString("de-DE")} Einträge{pages > 1 ? ` · Seite ${f.page} von ${pages}` : ""}</p>
      <div className="card fin-list audit-list">
        {rows.length === 0 ? <p className="hint">Keine Einträge für diese Auswahl.</p> : (
          <table>
            <thead><tr><th>Zeit</th><th>Wer</th><th>Was</th><th>Wo / Ziel</th><th>IP</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={r.ok ? "" : "is-neg"}>
                  <td>{fmt.format(r.at)}<small>Nr. {r.id}</small></td>
                  <td>{r.actorName ?? <span className="hint">nicht eingeloggt</span>}{r.actorRole && <small>{r.actorRole === "teacher" ? "Fahrschule" : "Schüler"}</small>}</td>
                  <td><span className={`badge ${r.ok ? "badge-muted" : "badge-error"}`}>{KIND[r.kind] ?? r.kind}</span> {r.action}
                    {Object.keys(r.details).length > 0 && (
                      <details className="audit-det"><summary>Details</summary><pre>{JSON.stringify(r.details, null, 2)}</pre>{r.ua && <small>Gerät: {r.ua}</small>}</details>
                    )}</td>
                  <td className="audit-target">{r.target}</td>
                  <td>{r.ip}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {pages > 1 && (
        <div className="row" style={{ justifyContent: "center", gap: 12 }}>
          {f.page > 1 && <Link className="btn btn-secondary btn-small" href={`/verwaltung/protokoll?${qs}&seite=${f.page - 1}`}>← neuer</Link>}
          {f.page < pages && <Link className="btn btn-secondary btn-small" href={`/verwaltung/protokoll?${qs}&seite=${f.page + 1}`}>älter →</Link>}
        </div>
      )}
    </>
  );
}
