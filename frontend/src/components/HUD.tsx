import { useUtcClock } from "../hooks/useUtcClock";
import { useAuroraStore } from "../store/auroraStore";
import type { ConjunctionWarning, Satellite, SpaceWeather } from "../types/space";
import { getKpColor } from "../utils/colors";
import { formatConjunctionPairLabel } from "../utils/conjunctionLabels";
import { describeFeedFreshness } from "../utils/feedFreshness";
import type { FreshnessStatus } from "../utils/feedFreshness";
import { formatDurationToTca, formatProbability, formatUtcTime, isCriticalConjunction } from "../utils/format";
import { formatKpIndex } from "../utils/measurements";
import { kpToPercent } from "../utils/kpScale";

interface HUDProps {
  satellites: Satellite[];
  conjunctions: ConjunctionWarning[];
  spaceWeather: SpaceWeather;
}

interface LayerRow {
  name: string;
  source: string;
  freshness: string;
  count: number;
  status: FreshnessStatus;
}

export const HUD = ({ satellites, conjunctions, spaceWeather }: HUDProps): JSX.Element | null => {
  const now = useUtcClock();
  const openPanel = useAuroraStore((state) => state.openPanel);
  const selectedConjunction = useAuroraStore((state) => state.selectedConjunction);
  const setSelectedConjunction = useAuroraStore((state) => state.setSelectedConjunction);
  const currentMode = useAuroraStore((state) => state.currentMode);
  const timelineEvent = useAuroraStore((state) => state.timelineEvent);
  const feedLastUpdated = useAuroraStore((state) => state.feedLastUpdated);

  const kpDisplay = timelineEvent?.kpIndex ?? spaceWeather.kpIndex;
  const windDisplay = timelineEvent?.solarWindSpeed ?? spaceWeather.solarWindSpeed;
  const bzDisplay = timelineEvent?.bzComponent ?? spaceWeather.bzComponent;
  const stormDisplay = timelineEvent?.stormLevel ?? spaceWeather.stormLevel;

  const kpPosition = kpToPercent(kpDisplay);

  // Mode-dependent color styles
  const isIntel = currentMode === "INTEL";
  const isStorm = currentMode === "STORM" || kpDisplay > 5;
  const textColor = isIntel ? "#ffffff" : isStorm ? "#ffd8b8" : "var(--aurora-text)";
  const accentColor = isIntel ? "#ff6600" : isStorm ? "#ff8844" : "var(--aurora-accent)";
  const subTextColor = isIntel ? "#cccccc" : isStorm ? "#ffccaa" : "#cde4f6";

  const satFresh = describeFeedFreshness(feedLastUpdated.satellites, now);
  const conjFresh = describeFeedFreshness(feedLastUpdated.conjunctions, now);
  const wxFresh = describeFeedFreshness(feedLastUpdated.spaceWeather, now);

  const layers: LayerRow[] = [
    {
      name: "Satellites",
      source: "CelesTrak",
      freshness: satFresh.label,
      count: satellites.length,
      status: satFresh.status
    },
    {
      name: "Conjunctions",
      source: "Space-Track",
      freshness: conjFresh.label,
      count: conjunctions.length,
      status: conjFresh.status
    },
    {
      name: "Space Weather",
      source: "NOAA SWPC",
      freshness: wxFresh.label,
      count: 1,
      status: wxFresh.status
    },
    {
      name: "Aurora Forecast",
      source: "NOAA Ovation",
      freshness: wxFresh.label,
      count: 2,
      status: wxFresh.status
    }
  ];

  if (currentMode === "HELIO") {
    return null;
  }

  return (
    <div
      className="pointer-events-none absolute inset-0 p-4 font-mono text-[13px] transition-colors duration-400"
      style={{ color: textColor }}
    >
      <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-4">
        <div
          className="hud-panel pointer-events-auto w-[330px] cursor-pointer self-start rounded p-3 transition-colors hover:border-cyan-400/50"
          onClick={() => openPanel("space-weather")}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              openPanel("space-weather");
            }
          }}
        >
          <p className="text-xs tracking-[0.2em]" style={{ color: accentColor }}>SPACE WEATHER</p>
          <div className="mt-2 flex items-end gap-3">
            <p className="text-2xl font-semibold" style={{ color: getKpColor(kpDisplay) }}>
              Kp {formatKpIndex(kpDisplay)}
            </p>
            <span className="rounded border border-white/20 px-2 py-0.5 text-xs uppercase tracking-[0.12em]">
              {stormDisplay}
            </span>
          </div>
          <div className="relative mt-2 h-2 w-full overflow-hidden rounded bg-gradient-to-r from-[#6dff79] via-[#ffcb3b] to-[#ff2a2a]">
            <div className="absolute -top-1 h-4 w-[2px] bg-white" style={{ left: `calc(${kpPosition}% - 1px)` }} />
          </div>

          <div className="mt-3 space-y-1 text-xs" style={{ color: subTextColor }}>
            <div className="flex justify-between">
              <span>Solar Wind Speed</span>
              <span>{windDisplay} km/s</span>
            </div>
            <div className="flex justify-between">
              <span>Solar Wind Density</span>
              <span>{spaceWeather.solarWindDensity.toFixed(1)} p/cm</span>
            </div>
            <div className="flex justify-between">
              <span>Bz Component</span>
              <span className={bzDisplay < 0 ? "text-[#ff4f4f]" : "text-[#7dff6a]"}>
                {bzDisplay.toFixed(1)} nT
              </span>
            </div>
            <div className="flex justify-between">
              <span>X-ray Flux</span>
              <span>{spaceWeather.xrayFlux}</span>
            </div>
          </div>
        </div>

        {currentMode === "OPS" ? (
          /* In OPS mode, conjunctions are accessed via the top-center warning badge + ranked list panel — keep empty cell for grid layout */
          <div />
        ) : (
          <div className="hud-panel pointer-events-auto ml-auto w-[430px] self-start rounded p-3">
            <p className="text-xs tracking-[0.2em]" style={{ color: accentColor }}>ACTIVE ALERTS</p>
            <div className="mt-2 space-y-1 text-xs" style={{ color: isIntel ? "#cccccc" : "#d8ebff" }}>
              {conjunctions.map((conjunction) => {
                const isCritical = isCriticalConjunction(conjunction);
                const isSelected = selectedConjunction?.id === conjunction.id;
                return (
                  <button
                    key={conjunction.id}
                    type="button"
                    onClick={() => setSelectedConjunction(conjunction)}
                    className={`flex w-full items-center gap-2 rounded border px-2 py-1 text-left transition-colors ${
                      isSelected
                        ? "border-cyan-400/70 bg-[#0b2b45]/60"
                        : "border-white/10 hover:border-cyan-400/50"
                    }`}
                  >
                    <span className={`h-2 w-2 rounded-full ${isCritical ? "animate-pulse bg-[#ff0000]" : "bg-[#ff6600]"}`} />
                    <span className="truncate">
                      {formatConjunctionPairLabel(conjunction, "-")} | TCA {formatDurationToTca(conjunction.tca)} | Pc{" "}
                      {formatProbability(conjunction.probability)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div
          className="hud-panel pointer-events-auto mt-auto w-[420px] cursor-pointer self-end rounded p-3 transition-colors hover:border-cyan-400/50"
          onClick={() => openPanel("data-layers")}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              openPanel("data-layers");
            }
          }}
        >
          <p className="text-xs tracking-[0.2em]" style={{ color: accentColor }}>DATA LAYERS</p>
          <div className="mt-2 space-y-1 text-xs">
            {layers.map((layer) => (
              <div key={layer.name} className="grid grid-cols-[8px_1.2fr_1fr_0.8fr_0.6fr] items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${layer.status === "live" ? (isIntel ? "bg-[#ff6600]" : "bg-[#00ff88]") : layer.status === "stale" ? "bg-[#ffcc00]" : "bg-[#ff4444]"}`} />
                <span>{layer.name}</span>
                <span style={{ color: isIntel ? "#999999" : "#9ec3df" }}>{layer.source}</span>
                <span>{layer.freshness}</span>
                <span className="text-right">{layer.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="ml-auto mt-auto self-end text-right">
          <div className="hud-panel pointer-events-auto inline-block rounded px-4 py-2">
            <p className="text-lg tracking-[0.25em]" style={{ color: accentColor }}>AURORA</p>
            <p className="text-xs" style={{ color: isIntel ? "#009933" : "#b9d6ee" }}>{formatUtcTime(now)}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
