import type { Counter, Phase, TrainingState } from "@/lib/training";

/** Ein Segment je 45-Min-Stunde: gefahren (gold), gebucht (gestreift), offen (leer). */
function Units({ c }: { c: Counter }) {
  if (c.target === null) {
    return (
      <div className="units-open">
        <strong>{c.done}</strong> gefahren{c.planned ? ` · ${c.planned} gebucht` : ""} <span className="hint">· Anzahl legt dein Fahrlehrer fest</span>
      </div>
    );
  }
  const total = Math.max(c.target, c.done + c.planned);
  const cells = Array.from({ length: total }, (_, i) => (i < c.done ? "done" : i < c.done + c.planned ? "planned" : "open"));
  return (
    <div className="units" role="img" aria-label={`${c.label}: ${Math.min(c.done, c.target)} von ${c.target} gefahren${c.planned ? `, ${c.planned} gebucht` : ""}`}>
      <div className="units-bar" style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}>
        {cells.map((k, i) => <span key={i} className={`u ${k} ${i >= c.target! ? "extra" : ""}`} />)}
      </div>
      <span className="units-num">{Math.min(c.done, c.target)}/{c.target}</span>
    </div>
  );
}

function PhaseCard({ ph, n }: { ph: Phase; n: number }) {
  const binary = ph.id === "testfahrt" || ph.id === "reife" || ph.id === "pruefung";
  return (
    <li className={`station ${ph.status}`}>
      <span className="station-dot" aria-hidden>{ph.status === "done" ? "✓" : n}</span>
      <div className="station-body">
        <div className="station-head">
          <h3>{ph.title}</h3>
          <span className="station-status">{ph.status === "done" ? "erledigt" : ph.status === "active" ? "jetzt dran" : "kommt noch"}</span>
        </div>
        {ph.status !== "locked" && <p className="hint">{ph.hint}</p>}
        {ph.status !== "locked" && (
          <div className="counters">
            {ph.counters.map((c, i) => binary ? (
              <div key={i} className={`check-item ${c.done ? "ok" : ""}`}>{c.done ? "✓" : c.planned ? "◔" : "○"} {c.label}{!c.done && c.planned ? " – gebucht" : ""}</div>
            ) : (
              <div key={i} className="counter">
                {ph.counters.length > 1 && <div className="counter-label">{c.label}</div>}
                <Units c={c} />
              </div>
            ))}
          </div>
        )}
      </div>
    </li>
  );
}

/** Fortschritts-Ring + Stationen – für Schüler und Fahrschule gleich. */
export function ProgressView({ state, classLabel, compact }: { state: TrainingState; classLabel: string; compact?: boolean }) {
  const r = 34, circ = 2 * Math.PI * r;
  return (
    <div className={`progress-view ${compact ? "compact" : ""}`}>
      <div className="progress-top">
        <svg className="ring" viewBox="0 0 80 80" role="img" aria-label={`${state.percent} Prozent geschafft`}>
          <circle cx="40" cy="40" r={r} className="ring-bg" />
          <circle cx="40" cy="40" r={r} className="ring-fg" strokeDasharray={circ} strokeDashoffset={circ * (1 - state.percent / 100)} />
          <text x="40" y="45" textAnchor="middle">{state.percent}%</text>
        </svg>
        <div>
          <div className="hint">{classLabel}</div>
          <div className="progress-next">{state.next}</div>
        </div>
      </div>
      <ol className="road">
        {state.phases.map((ph, i) => <PhaseCard key={ph.id} ph={ph} n={i + 1} />)}
      </ol>
      <div className="units-legend hint"><span><i className="u done" /> gefahren</span><span><i className="u planned" /> gebucht</span><span><i className="u open" /> offen</span></div>
    </div>
  );
}
