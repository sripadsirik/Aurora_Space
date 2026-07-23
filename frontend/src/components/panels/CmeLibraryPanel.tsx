import { useAuroraStore } from "../../store/auroraStore";
import { mockCMEs } from "../../data/mock/cmeLibrary";
import { getKpColor } from "../../utils/colors";
import { gScaleColor } from "../../utils/spaceWeatherScales";
import type { MockCME } from "../../types/space";

const CmeCard = ({ cme, isSelected, onSelect }: {
  cme: MockCME;
  isSelected: boolean;
  onSelect: () => void;
}): JSX.Element => {
  const isMiss = cme.impactStatus === "NO IMPACT — MISS";
  const isArrived = cme.hoursUntilArrival <= 0;

  let arrivalText: string;
  if (isMiss) {
    arrivalText = `PASSES EARTH ORBIT IN ${cme.hoursUntilArrival}h — NO IMPACT`;
  } else if (isArrived) {
    arrivalText = `ARRIVED ${Math.abs(cme.hoursUntilArrival)}h ago`;
  } else {
    const prefix = cme.impactStatus === "GLANCING BLOW" ? "GLANCING ARRIVAL — " : "";
    arrivalText = `${prefix}${cme.hoursUntilArrival}h until arrival`;
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full rounded border px-2.5 py-2 text-left transition-all"
      style={{
        borderColor: isSelected ? "#00d4ff80" : isMiss ? "#7dff6a20" : "rgba(255,255,255,0.1)",
        backgroundColor: isSelected ? "rgba(0,212,255,0.08)" : "transparent",
        boxShadow: isSelected ? "0 0 12px rgba(0,212,255,0.12)" : "none"
      }}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-white">{cme.label}</span>
        {isMiss ? (
          <span className="rounded border border-[#7dff6a50] bg-[#7dff6a15] px-1.5 py-0.5 text-[9px] text-[#7dff6a]">
            MISS
          </span>
        ) : (
          <span
            className="rounded border px-1.5 py-0.5 text-[9px] font-bold"
            style={{
              borderColor: gScaleColor(cme.stormLevel),
              color: gScaleColor(cme.stormLevel),
              backgroundColor: `${gScaleColor(cme.stormLevel)}15`
            }}
          >
            {cme.stormLevel}
          </span>
        )}
      </div>

      <p className="mt-0.5 text-[9px] text-[#8ab0cc]">{cme.direction}</p>

      <div className="mt-1 flex items-center justify-between text-[10px]">
        <span className="text-[#aaccdd]">{cme.speed} km/s</span>
        <span className={isArrived ? "text-[#ff6644]" : isMiss ? "text-[#7dff6a]" : "text-[#ffcc88]"}>
          {arrivalText}
        </span>
      </div>

      {/* Confidence bar */}
      <div className="mt-1.5 flex items-center gap-2">
        <span className="text-[9px] text-[#7d9cb5]">Confidence</span>
        <div className="h-1 flex-1 rounded-full bg-white/10">
          <div
            className="h-1 rounded-full bg-[#00d4ff]"
            style={{ width: `${cme.confidence}%`, opacity: 0.7 }}
          />
        </div>
        <span className="text-[9px] text-[#d8f8ff]">{cme.confidence}%</span>
      </div>

      {!isMiss && (
        <p className="mt-0.5 text-[9px] text-[#7d9cb5]">
          Predicted Kp: <span style={{ color: getKpColor(cme.predictedKp) }}>{cme.predictedKp}</span>
        </p>
      )}

      {/* Expanded detail when selected */}
      {isSelected && !isMiss && (
        <div className="mt-2 space-y-1 border-t border-cyan-500/15 pt-2 text-[10px]">
          <div className="flex justify-between">
            <span className="text-[#7d9cb5]">Predicted Kp</span>
            <span className="text-lg font-bold" style={{ color: getKpColor(cme.predictedKp) }}>
              {cme.predictedKp}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#7d9cb5]">Storm Level</span>
            <span style={{ color: gScaleColor(cme.stormLevel) }}>{cme.stormLevel}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#7d9cb5]">Expected Duration</span>
            <span className="text-[#d8f8ff]">18-36 hours</span>
          </div>
          <div className="mt-1">
            <span className="text-[#7d9cb5]">Primary Impacts:</span>
            <ul className="mt-0.5 space-y-0.5 text-[9px] text-[#ffccaa]">
              <li>HF Radio degradation</li>
              <li>GPS accuracy reduction</li>
              {cme.predictedKp >= 7 && <li>Power grid stress</li>}
              {cme.predictedKp >= 8 && <li>Satellite charging risk</li>}
            </ul>
          </div>
        </div>
      )}

      {isSelected && isMiss && cme.note && (
        <div className="mt-2 border-t border-green-500/15 pt-2 text-[9px] text-[#7dff6a80]">
          {cme.note}
        </div>
      )}
    </button>
  );
};

export const CmeLibraryPanel = (): JSX.Element | null => {
  const currentMode = useAuroraStore((s) => s.currentMode);
  const helioSelectedCME = useAuroraStore((s) => s.helioSelectedCME);
  const setHelioSelectedCME = useAuroraStore((s) => s.setHelioSelectedCME);

  if (currentMode !== "HELIO") return null;

  return (
    <div className="pointer-events-auto fixed right-4 top-4 z-[70] w-[280px] rounded border border-cyan-400/20 bg-[rgba(5,15,30,0.92)] font-mono text-[11px] shadow-[0_0_30px_rgba(0,180,255,0.08)] backdrop-blur-xl">
      <div className="border-b border-cyan-500/15 px-3 py-2">
        <span className="text-xs tracking-[0.18em] text-[#00d4ff]">CME LIBRARY</span>
      </div>

      <div className="max-h-[calc(100vh-120px)] space-y-2 overflow-y-auto px-2 py-2">
        {mockCMEs.map((cme) => (
          <CmeCard
            key={cme.id}
            cme={cme}
            isSelected={helioSelectedCME === cme.id}
            onSelect={() => setHelioSelectedCME(helioSelectedCME === cme.id ? null : cme.id)}
          />
        ))}
      </div>
    </div>
  );
};
