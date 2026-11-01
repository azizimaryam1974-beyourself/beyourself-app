import { deleteDocAction, docStatusAction } from "@/app/doc-actions";
import { DOC_INFO, DOC_STATUS_LABEL, DOC_TYPES, type DocType, type StudentDoc } from "@/lib/server/student-docs";
import { DocUpload } from "./DocUpload";

const fmt = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric" });
const BADGE = { neu: "badge-warn", ok: "badge-ok", abgelehnt: "badge-error" } as const;

/** Liste aller Unterlagen mit Status – für Schüler (Konto) und Fahrschule (Akte). */
export function StudentDocs({ docs, teacher, userId, umschreibung }: { docs: StudentDoc[]; teacher?: boolean; userId?: string; umschreibung?: boolean }) {
  const types = DOC_TYPES.filter((t) => umschreibung ? t !== "erstehilfe" : !DOC_INFO[t].umschreibungOnly);
  return (
    <ul className="doc-list">
      {types.map((t: DocType) => {
        const mine = docs.filter((d) => d.type === t);
        const state = mine.some((d) => d.status === "ok") ? "ok" : mine.some((d) => d.status === "neu") ? "neu" : mine.length ? "abgelehnt" : "fehlt";
        return (
          <li key={t} className={`doc-item doc-${state}${t === "ausweis" ? " doc-main" : ""}`}>
            <div className="doc-top">
              <span className="doc-dot" aria-hidden>{state === "ok" ? "✓" : state === "neu" ? "…" : state === "abgelehnt" ? "!" : ""}</span>
              <div className="doc-text">
                <strong>{DOC_INFO[t].label}</strong>
                <small>{DOC_INFO[t].who}{teacher ? "" : ` · ${DOC_INFO[t].hint}`}</small>
              </div>
              <DocUpload type={t} userId={userId} label={mine.length ? "Weitere Seite" : "Hochladen"} primary={t === "ausweis" && !mine.length} />
            </div>
            {mine.length > 0 && (
              <ul className="doc-files">
                {mine.map((d) => (
                  <li key={d.id}>
                    <a href={`/api/unterlagen/datei/${d.id}`} target="_blank" rel="noreferrer">📎 {d.name}</a>
                    <span className="hint">{fmt.format(d.uploadedAt)}</span>
                    <span className={`badge ${BADGE[d.status]}`}>{DOC_STATUS_LABEL[d.status]}</span>
                    {d.status === "abgelehnt" && d.note && <span className="hint">Grund: {d.note}</span>}
                    {teacher ? (
                      <span className="doc-acts">
                        {d.status !== "ok" && <form action={docStatusAction}><input type="hidden" name="id" value={d.id} /><input type="hidden" name="status" value="ok" /><button className="btn btn-small" type="submit">Geprüft</button></form>}
                        {d.status !== "abgelehnt" && (
                          <details className="doc-reject">
                            <summary className="link-btn">ablehnen</summary>
                            <form action={docStatusAction} className="row">
                              <input type="hidden" name="id" value={d.id} />
                              <input type="hidden" name="status" value="abgelehnt" />
                              <input name="note" placeholder="Grund, z. B. unscharf" maxLength={200} style={{ flex: "1 1 160px" }} />
                              <button className="btn btn-secondary btn-small" type="submit">Neu anfordern</button>
                            </form>
                          </details>
                        )}
                        <form action={deleteDocAction}><input type="hidden" name="id" value={d.id} /><button className="link-btn" type="submit">löschen</button></form>
                      </span>
                    ) : d.status !== "ok" && (
                      <form action={deleteDocAction}><input type="hidden" name="id" value={d.id} /><button className="link-btn" type="submit">entfernen</button></form>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}
