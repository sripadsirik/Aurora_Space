import { useEffect } from "react";

import { useUtcClock } from "../../hooks/useUtcClock";
import { useAuroraStore } from "../../store/auroraStore";
import { formatConjunctionPairLabel } from "../../utils/conjunctionLabels";
import {
  classifyConjunctionRisk,
  conjunctionRiskTextClass,
  sortConjunctionsByProbabilityDesc
} from "../../utils/conjunctionRisk";
import { formatDurationToTca, formatManeuverDeltaV, formatProbability } from "../../utils/format";

interface AltitudeBand {
  label: string;
  level: string;
  color: string;
  barWidth: number;
}

const altitudeBands: AltitudeBand[] = [
  { label: "400-600km", level: "LOW", color: "#7dff6a", barWidth: 30 },
  { label: "600-800km", level: "HIGH", color: "#ff2a2a", barWidth: 85 },
  { label: "800-1200km", level: "MEDIUM", color: "#ff8b38", barWidth: 55 },
  { label: "1200-2000km", level: "LOW", color: "#7dff6a", barWidth: 25 },
  { label: "GEO (35786)", level: "MEDIUM", color: "#ff8b38", barWidth: 45 }
];

interface DebrisField {
  name: string;
  origin: string;
  date: string;
  trackedCount: number;
  conjunctions: number;
}

const debrisFields: DebrisField[] = [
  {
    name: "FENGYUN-1C DEBRIS FIELD",
    origin: "Chinese ASAT test",
    date: "2007-01-11",
    trackedCount: 3000,
    conjunctions: 2
  },
  {
    name: "COSMOS-IRIDIUM DEBRIS FIELD",
    origin: "Cosmos 2251 / Iridium 33 collision",
    date: "2009-02-10",
    trackedCount: 1800,
    conjunctions: 1
  }
];

export const IntelAnalysisPanel = (): JSX.Element | null => {
  const currentMode = useAuroraStore((s) => s.currentMode);
  const conjunctions = useAuroraStore((s) => s.conjunctions);
  const setSelectedConjunction = useAuroraStore((s) => s.setSelectedConjunction);
  const openPanel = useAuroraStore((s) => s.openPanel);
  useUtcClock();

  useEffect(() => {
    if (currentMode === "INTEL") {
      openPanel("intel-analysis");
    }
  }, [currentMode, openPanel]);

  if (currentMode !== "INTEL") return null;

  const sorted = sortConjunctionsByProbabilityDesc(conjunctions);

  return (
    <div
      className="pointer-events-auto fixed left-4 top-4 z-[70] w-[320px] rounded border font-mono text-[11px] backdrop-blur-xl"
      style={{
        borderColor: "rgba(255,100,0,0.3)",
        backgroundColor: "rgba(0,0,0,0.92)"
      }}
    >
      <div className="border-b border-orange-500/20 px-3 py-2">
        <span className="text-xs tracking-[0.18em] text-[#ff6600]">CONJUNCTION INTELLIGENCE</span>
      </div>

      <div className="max-h-[calc(100vh-120px)] space-y-3 overflow-y-auto px-3 py-2">
        {/* Active Threats */}
        <div>
          <p className="text-[10px] tracking-[0.16em] text-[#ff6600]">ACTIVE THREATS</p>
          <table className="mt-1 w-full text-[10px]">
            <thead>
              <tr className="text-[#8a7060]">
                <th className="px-1 py-0.5 text-left">#</th>
                <th className="px-1 py-0.5 text-left">PAIR</th>
                <th className="px-1 py-0.5 text-right">Pc</th>
                <th className="px-1 py-0.5 text-right">TCA</th>
                <th className="px-1 py-0.5 text-right">DV</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((conj, idx) => {
                const risk = classifyConjunctionRisk(conj.probability);
                const rowColor = conjunctionRiskTextClass(risk, "text-white");
                const deltaV = formatManeuverDeltaV(conj.probability);
                return (
                  <tr
                    key={conj.id}
                    className={`cursor-pointer border-t border-white/5 transition-colors hover:bg-orange-500/10 ${rowColor}`}
                    onClick={() => setSelectedConjunction(conj)}
                  >
                    <td className="px-1 py-1">{idx + 1}</td>
                    <td className="max-w-[120px] truncate px-1 py-1">
                      {formatConjunctionPairLabel(conj)}
                    </td>
                    <td className="px-1 py-1 text-right">{formatProbability(conj.probability)}</td>
                    <td className="px-1 py-1 text-right">{formatDurationToTca(conj.tca)}</td>
                    <td className="px-1 py-1 text-right">{deltaV}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Orbital Regime Risk */}
        <div className="border-t border-orange-500/10 pt-2">
          <p className="text-[10px] tracking-[0.16em] text-[#ff6600]">ORBITAL REGIME RISK</p>
          <div className="mt-1 space-y-1">
            {altitudeBands.map((band) => (
              <div key={band.label} className="flex items-center gap-2">
                <span className="w-[80px] text-[10px] text-[#aaa]">{band.label}</span>
                <div className="flex-1">
                  <div
                    className="h-2 rounded-sm"
                    style={{
                      width: `${band.barWidth}%`,
                      backgroundColor: band.color,
                      opacity: 0.7
                    }}
                  />
                </div>
                <span className="w-[50px] text-right text-[9px]" style={{ color: band.color }}>
                  {band.level}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Debris Fields */}
        <div className="border-t border-orange-500/10 pt-2">
          <p className="text-[10px] tracking-[0.16em] text-[#ff6600]">DEBRIS FIELDS</p>
          <div className="mt-1 space-y-2">
            {debrisFields.map((field) => (
              <div
                key={field.name}
                className="cursor-pointer rounded border border-orange-500/15 px-2 py-1.5 transition-colors hover:bg-orange-500/10"
              >
                <p className="text-[10px] font-semibold text-[#ff8844]">{field.name}</p>
                <p className="text-[9px] text-[#aaa]">{field.origin} — {field.date}</p>
                <div className="mt-0.5 flex justify-between text-[9px]">
                  <span className="text-[#ccc]">Tracked: {field.trackedCount.toLocaleString()}</span>
                  <span className="text-[#ffcc88]">{field.conjunctions} active events</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
