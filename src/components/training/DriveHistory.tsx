import type { DriveEntry } from "@/lib/server/drive-history";
import { KIND_LABEL } from "@/lib/training";

const fmtDate = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" });
const fmtT = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" });
const LABEL: Record<DriveEntry["status"], [string, string]> = {
  done: ["gefahren", "badge-ok"], no_show: ["nicht erschienen", "badge-error"], late: ["zu spät – ausgefallen", "badge-error"],
  booked: ["gebucht", "badge-warn"], open: ["noch nicht bezahlt", "badge-muted"],
};

/** Fahrt-Historie als Liste: Datum, Uhrzeit, Art, Dauer, mit wem, Treffpunkt. `actions` hängt z. B. Knöpfe für die Fahrschule an. */
export function DriveHistoryList({ past, upcoming, actions }: { past: DriveEntry[]; upcoming: DriveEntry[]; actions?: (e: DriveEntry) => React.ReactNode }) {
  const doneMin = past.filter((e) => e.status === "done").reduce((a, e) => a + e.minutes, 0);
  const Row = ({ e }: { e: DriveEntry }) => (
    <li className={`dh-item dh-${e.status}`}>
      <div className="dh-when"><strong>{fmtDate.format(e.at)}</strong><span>{fmtT.format(e.at)}–{fmtT.format(e.end)} Uhr</span></div>
      <div className="dh-what">
        <strong>{KIND_LABEL[e.kind]} · {e.minutes} Min</strong>
        <span>mit {e.teacher.split(" ")[0]}{e.meeting ? ` · Treffpunkt: ${e.meeting}` : ""}{e.source === "manual" ? " · nachgetragen" : ""}</span>
        {e.note && <span className="hint">{e.note}</span>}
      </div>
      <div className="dh-side"><span className={`badge ${LABEL[e.status][1]}`}>{LABEL[e.status][0]}</span>{actions?.(e)}</div>
    </li>
  );
  return (
    <div className="dh">
      <div className="dh-sum">
        <span><strong>{past.filter((e) => e.status === "done").length}</strong> Fahrten gefahren</span>
        <span><strong>{(doneMin / 60).toFixed(1).replace(".", ",")}</strong> Stunden</span>
        <span><strong>{upcoming.length}</strong> geplant</span>
      </div>
      {upcoming.length > 0 && <><h3 className="dh-h">Kommende Fahrten</h3><ul className="dh-list">{upcoming.map((e) => <Row key={e.id} e={e} />)}</ul></>}
      <h3 className="dh-h">Bisher</h3>
      {past.length === 0 ? <p className="hint">Noch keine Fahrten.</p> : <ul className="dh-list">{past.map((e) => <Row key={e.id} e={e} />)}</ul>}
    </div>
  );
}
