import { useMemo, type CSSProperties } from "react";
import { useUtcClock } from "../../hooks/useUtcClock";
import { useAuroraStore } from "../../store/auroraStore";
import { useSceneStore } from "../../store/sceneStore";
import { conjunctionObjectLabel, orderedConjunctionPairs } from "../../utils/conjunctionPairs";
import { formatDurationToTca, formatMissDistance, formatProbability } from "../../utils/format";

export function ConjunctionWorkbench() {
  const conjunctions = useAuroraStore(s => s.conjunctions);
  const selected = useAuroraStore(s => s.selectedConjunction);
  const select = useAuroraStore(s => s.setSelectedConjunction);
  const scene = useSceneStore();
  const pairs = useMemo(() => orderedConjunctionPairs(conjunctions), [conjunctions]);
  const current = pairs.find(p => p.conjunction.id === selected?.id);
  useUtcClock();
  const showAll = () => { scene.setConjunctionFocus(false); select(null, false); };
  return <div className="conjunction-workbench">
    <div className="pair-heading"><div><span className="scene-eyebrow">ENCOUNTER EXPLORER</span><h2>One pair. Two paths.</h2></div><span className="pair-total">{pairs.length}<small>pairs</small></span></div>
    <p className="pair-intro">Pick a pair below or click an orbit. Its two paths light up together; the rest fade into the background.</p>
    <div className="scene-segmented pair-view-switch" role="group" aria-label="Conjunction display">
      <button aria-pressed={!scene.conjunctionFocus || !current} onClick={showAll}>All paths</button>
      <button aria-pressed={scene.conjunctionFocus && !!current} disabled={!current} onClick={() => scene.setConjunctionFocus(true)}>Isolate pair</button>
    </div>
    <div className="pair-line-key"><span><i />A · solid</span><span><i className="pair-line-dashed" />B · dashed</span><span>Color = pair</span></div>
    {!scene.conjunctionPaths && <button className="pair-enable" onClick={() => scene.toggle("conjunctionPaths")}>Show conjunction paths →</button>}
    {current && <section className="pair-inspector" aria-label="Selected conjunction pair" style={{ "--pair-color": current.color } as CSSProperties}>
      <div className="pair-inspector-top"><strong>PAIR {current.number}</strong><span className={`pair-risk pair-risk--${current.conjunction.riskLevel}`}>{current.conjunction.riskLevel}</span><button onClick={showAll} aria-label="Clear selected pair">×</button></div>
      {[current.conjunction.object1, current.conjunction.object2].map((object, i) => <div className="pair-object" key={`${i}-${object.noradId}`}><span className={`pair-object-letter ${i ? "pair-object-letter--dashed" : ""}`}>{i ? "B" : "A"}</span><div><strong>{conjunctionObjectLabel(object)}</strong><small>NORAD {object.noradId}</small></div></div>)}
      <dl className="pair-metrics"><div><dt>Reported TCA</dt><dd>{formatDurationToTca(current.conjunction.tca)}</dd></div><div><dt>Miss distance</dt><dd>{formatMissDistance(current.conjunction.missDistanceM)}</dd></div><div><dt>Reported Pc</dt><dd>{formatProbability(current.conjunction.pc)}</dd></div></dl>
      <button className="pair-details" onClick={() => select(current.conjunction)}>Open full report ↗</button>
    </section>}
    <div className="pair-list-heading"><span>UPCOMING PAIRS</span><span>{scene.conjunctionPathCount ? `${scene.conjunctionPathCount.available}/${scene.conjunctionPathCount.total} paths available` : "Loading paths"}</span></div>
    <div className="pair-list" role="group" aria-label="Conjunction pairs">{pairs.map(({ conjunction: c, number, color }) => <button key={c.id} className="pair-row" aria-pressed={current?.conjunction.id === c.id} aria-label={`Select pair ${number}: ${conjunctionObjectLabel(c.object1)} and ${conjunctionObjectLabel(c.object2)}`} onClick={() => { if (!scene.conjunctionPaths) scene.toggle("conjunctionPaths"); select(c, false); }} style={{ "--pair-color": color } as CSSProperties}>
      <span className="pair-index">{number}</span><span className="pair-row-objects"><span><b>A</b>{conjunctionObjectLabel(c.object1)}</span><span><b>B</b>{conjunctionObjectLabel(c.object2)}</span></span><span className="pair-row-time">{formatDurationToTca(c.tca)}<small>{formatMissDistance(c.missDistanceM)}</small></span>
    </button>)}{!pairs.length && <p className="pair-intro">No upcoming conjunction reports in the current feed.</p>}</div>
    <p className="pair-footnote">Paths show catalog orbits. Crossing lines on this view do not mark a predicted collision. A/B labels mark current predicted positions.</p>
  </div>;
}
