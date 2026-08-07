import { useUtcClock } from "../../hooks/useUtcClock";
import { useAuroraStore } from "../../store/auroraStore";
import {
  classifyConjunctionRisk,
  conjunctionRiskTextClass,
  sortConjunctionsByProbabilityDesc
} from "../../utils/conjunctionRisk";
import { formatDurationToTca, formatProbability } from "../../utils/format";

export const ActiveConjunctionsPanel = (): JSX.Element | null => {
  const activePanels = useAuroraStore((s) => s.activePanels);
  const conjunctions = useAuroraStore((s) => s.conjunctions);
  const closePanel = useAuroraStore((s) => s.closePanel);
  const setSelectedConjunction = useAuroraStore((s) => s.setSelectedConjunction);
  useUtcClock();

  if (!activePanels.has("active-conjunctions")) return null;

  const sorted = sortConjunctionsByProbabilityDesc(conjunctions);

  return (
    <div className="pointer-events-auto fixed left-1/2 top-16 z-[70] w-[520px] -translate-x-1/2 rounded border border-cyan-400/25 bg-[rgba(5,15,30,0.92)] font-mono text-[11px] shadow-[0_0_30px_rgba(0,180,255,0.08)] backdrop-blur-xl">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
        <span className="text-xs tracking-[0.18em] text-[var(--aurora-accent)]">ACTIVE CONJUNCTIONS</span>
        <button
          type="button"
          onClick={() => closePanel("active-conjunctions")}
          className="h-6 w-6 text-base leading-none text-[#c2def3] hover:text-white"
        >
          x
        </button>
      </div>
      <div className="max-h-[300px] overflow-y-auto px-2 py-1">
        <table className="w-full text-[10px]">
          <thead>
            <tr className="text-[#6b8fa8]">
              <th className="px-1 py-1 text-left">#</th>
              <th className="px-1 py-1 text-left">PAIR</th>
              <th className="px-1 py-1 text-right">Pc</th>
              <th className="px-1 py-1 text-right">TCA</th>
              <th className="px-1 py-1 text-right">MISS (m)</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((conj, idx) => {
              const risk = classifyConjunctionRisk(conj.probability);
              const rowColor = conjunctionRiskTextClass(risk, "text-[#d8ebff]");
              return (
                <tr
                  key={conj.id}
                  className={`cursor-pointer border-t border-white/5 transition-colors hover:bg-white/5 ${rowColor}`}
                  onClick={() => {
                    setSelectedConjunction(conj);
                    closePanel("active-conjunctions");
                  }}
                >
                  <td className="px-1 py-1.5">{idx + 1}</td>
                  <td className="px-1 py-1.5 truncate max-w-[200px]">
                    {conj.object1.name} x {conj.object2.name}
                  </td>
                  <td className="px-1 py-1.5 text-right">{formatProbability(conj.probability)}</td>
                  <td className="px-1 py-1.5 text-right">{formatDurationToTca(conj.tca)}</td>
                  <td className="px-1 py-1.5 text-right">{conj.missDistanceM}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
