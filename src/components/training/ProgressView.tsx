import { asLessons, LESSON_MIN, type Counter, type Phase, type TrainingState } from "@/lib/training";

/**
 * Ein Kästchen je Ausbildungsstunde (45 Min). Gefahren = gold, gebucht = gestreift, offen = leer.
 * Fahrten von 60/75/90/135 Min füllen Kästchen auch anteilig.
 */
function Units({ c }: { c: Counter }) {
  if (c.target === null) {
    return (
      <div className="units-open">
        <strong>{asLessons(c.done)}</strong> gefahren{c.planned ? ` · ${asLessons(c.planned)} gebucht` : ""} <span className="hint">· Anzahl legt dein Fahrlehrer fest</span>
      </div>
    );
  }
  const L = LESSON_MIN;
  const total = Math.max(c.target, c.done + c.planned);
  const n = Math.ceil(total / L);
  const cells = Array.from({ length: n }, (_, i) => {
    const from = i * L, to = from + L;
    const part = (a: number, b: number) => Math.max(0, Math.min(to, b) - Math.max(from, a)) / L;
    return { done: part(0, c.done) * 100, planned: part(c.done, c.done + c.planned) * 100, extra: from >= c.target! };
  });
  const shown = Math.min(c.done, c.target);
  return (
    <div className="units" role="img" aria-label={`${c.label}: ${shown} von ${c.target} Minuten gefahren${c.planned ? `, ${c.planned} Minuten gebucht` : ""}`}>
      <div className="units-bar" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
        {cells.map((x, i) => (
          <span key={i} className={`u ${x.extra ? "extra" : ""}`}>
            {x.done > 0 && <i className="f done" style={{ width: `${x.done}%` }} />}
            {x.planned > 0 && <i className="f planned" style={{ width: `${x.planned}%` }} />}
          </span>
        ))}
      </div>
      <span className="units-num" title={`${shown} von ${c.target} Min`}>{asLessons(shown).replace(" Std.", "")}/{asLessons(c.target)}</span>
    </div>
  );
}

function PhaseCard({ ph, n }: { ph: Phase; n: number }) {
  
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
            {ph.counters.map((c, i) => c.binary ? (
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
      <div className="units-legend hint"><span><i className="lg-done" /> gefahren</span><span><i className="lg-planned" /> gebucht</span><span><i className="lg-open" /> offen</span><span>1 Kästchen = 1 Stunde (45 Min)</span></div>
    </div>
  );
}
