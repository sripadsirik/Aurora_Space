import { useEffect, useMemo } from "react";

import { useAuroraStore } from "../../store/auroraStore";
import { getKpColor } from "../../utils/colors";
import { gScaleColor, kpToGScale } from "../../utils/spaceWeatherScales";
import { getStormSystemImpacts } from "../../utils/stormSystemImpacts";
import { countStormExposedAssets } from "../../utils/stormExposure";
import { buildSparkline, sparklineThresholdY } from "../../utils/sparkline";

const mockKpHistory = [
  2.3, 2.1, 2.5, 2.8, 3.0, 3.2, 3.1, 2.9,
  3.4, 3.8, 4.1, 4.5, 4.8, 5.2, 5.6, 5.9,
  6.2, 6.8, 7.1, 6.5, 5.8, 5.2, 4.8, 4.3
];

export const StormImpactPanel = (): JSX.Element | null => {
  const currentMode = useAuroraStore((s) => s.currentMode);
  const spaceWeather = useAuroraStore((s) => s.spaceWeather);
  const satellites = useAuroraStore((s) => s.satellites);
  const timelineEvent = useAuroraStore((s) => s.timelineEvent);
  const openPanel = useAuroraStore((s) => s.openPanel);

  const kp = timelineEvent?.kpIndex ?? spaceWeather.kpIndex;

  useEffect(() => {
    if (currentMode === "STORM") {
      openPanel("storm-impact");
    }
  }, [currentMode, openPanel]);

  const riskCounts = useMemo(() => countStormExposedAssets(satellites), [satellites]);

  if (currentMode !== "STORM") return null;

  const gLevel = kpToGScale(kp);
  const gColor = gScaleColor(gLevel);
  const impacts = getStormSystemImpacts(kp);

  // KP Sparkline
  const sparklineWidth = 240;
  const sparklineHeight = 40;
  const sparklineScale = { width: sparklineWidth, height: sparklineHeight, min: 0, max: 9 };
  const { points, path: pathD } = buildSparkline(mockKpHistory, sparklineScale);

  return (
    <div
      className="pointer-events-auto fixed left-4 top-4 z-[70] w-[300px] rounded border font-mono text-[11px] shadow-[0_0_30px_rgba(255,60,0,0.08)] backdrop-blur-xl"
      style={{
        borderColor: "rgba(255,60,0,0.3)",
        backgroundColor: "rgba(5,15,30,0.92)",
        boxShadow: "0 0 30px rgba(255,60,0,0.08), inset 0 0 1px rgba(255,60,0,0.15)"
      }}
    >
      <div className="border-b border-red-500/20 px-3 py-2">
        <span className="text-xs tracking-[0.18em] text-[#ff6644]">STORM IMPACT ASSESSMENT</span>
      </div>

      <div className="space-y-3 px-3 py-2">
        {/* Current Storm */}
        <div>
          <p className="text-[10px] tracking-[0.16em] text-[#ff8844]">CURRENT STORM</p>
          <div className="mt-1 flex items-center gap-3">
            <span
              className="rounded border px-2 py-0.5 text-[14px] font-bold"
              style={{ borderColor: gColor, color: gColor, backgroundColor: `${gColor}18` }}
            >
              {gLevel}
            </span>
            <div>
              <p className="text-lg font-semibold" style={{ color: getKpColor(kp) }}>
                Kp {kp.toFixed(1)}
              </p>
            </div>
          </div>
          <div className="mt-1 space-y-0.5 text-[10px] text-[#ffccaa]">
            <p>Storm start: 14 minutes ago (mock)</p>
            <p>Est. duration: 6-12 hours (mock)</p>
          </div>
        </div>

        {/* At-Risk Assets */}
        <div className="border-t border-red-500/10 pt-2">
          <p className="text-[10px] tracking-[0.16em] text-[#ff8844]">AT-RISK ASSETS</p>
          <div className="mt-1 space-y-1">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#ff8b38]" />
                LEO — Drag Risk
              </span>
              <span className="text-[#ffcc88]">{riskCounts.leoDrag} satellites</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#ffcc00]" />
                GEO — Charge Risk
              </span>
              <span className="text-[#ffcc88]">{riskCounts.geoCharging} satellites</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#ff2a2a]" />
                Debris — Decay Risk
              </span>
              <span className="text-[#ffcc88]">{riskCounts.debris} objects</span>
            </div>
          </div>
        </div>

        {/* Affected Systems */}
        <div className="border-t border-red-500/10 pt-2">
          <p className="text-[10px] tracking-[0.16em] text-[#ff8844]">AFFECTED SYSTEMS (mock)</p>
          <div className="mt-1 space-y-1">
            {impacts.map((row) => (
              <div key={row.system} className="flex items-center justify-between">
                <span className="text-[#d8c8b8]">{row.system}</span>
                <span style={{ color: row.color }} className="text-[10px]">{row.status}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Kp Sparkline */}
        <div className="border-t border-red-500/10 pt-2">
          <p className="text-[10px] tracking-[0.16em] text-[#ff8844]">KP HISTORY (24h, mock)</p>
          <svg
            viewBox={`-4 -4 ${sparklineWidth + 8} ${sparklineHeight + 8}`}
            className="mt-1 h-[50px] w-full"
          >
            {/* Threshold lines */}
            <line
              x1="0" y1={sparklineHeight - (5 / 9) * sparklineHeight}
              x2={sparklineWidth} y2={sparklineHeight - (5 / 9) * sparklineHeight}
              stroke="#ffcc0030" strokeWidth="1" strokeDasharray="4 4"
            />
            <line
              x1="0" y1={sparklineHeight - (7 / 9) * sparklineHeight}
              x2={sparklineWidth} y2={sparklineHeight - (7 / 9) * sparklineHeight}
              stroke="#ff2a2a30" strokeWidth="1" strokeDasharray="4 4"
            />
            {/* Path */}
            <path d={pathD} fill="none" stroke="#ff8844" strokeWidth="1.5" />
            {/* Segment coloring */}
            {points.map((p, i) => {
              const color = p.value > 7 ? "#ff2a2a" : p.value >= 5 ? "#ffcc00" : "#7dff6a";
              return (
                <circle key={i} cx={p.x} cy={p.y} r="2" fill={color} />
              );
            })}
            {/* Current value dot */}
            <circle
              cx={points[points.length - 1].x}
              cy={points[points.length - 1].y}
              r="4"
              fill={getKpColor(mockKpHistory[mockKpHistory.length - 1])}
              stroke="white"
              strokeWidth="1"
            />
          </svg>
        </div>
      </div>
    </div>
  );
};
