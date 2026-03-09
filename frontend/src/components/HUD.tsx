import { useMemo } from "react";

import { useUtcClock } from "../hooks/useUtcClock";
import { useAuroraStore } from "../store/auroraStore";
import type { ConjunctionWarning, Satellite, SpaceWeather } from "../types/space";
import { getKpColor } from "../utils/colors";
import { formatDurationToTca, formatProbability, formatUtcTime, isCriticalConjunction } from "../utils/format";

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
  isLive: boolean;
}

export const HUD = ({ satellites, conjunctions, spaceWeather }: HUDProps): JSX.Element => {
  const now = useUtcClock();
  const openPanel = useAuroraStore((state) => state.openPanel);
  const selectedConjunction = useAuroraStore((state) => state.selectedConjunction);
  const setSelectedConjunction = useAuroraStore((state) => state.setSelectedConjunction);

  const kpPosition = Math.max(0, Math.min(100, (spaceWeather.kpIndex / 9) * 100));

  const layers = useMemo<LayerRow[]>(
    () => [
      {
        name: "Satellites",
        source: "CelesTrak",
        freshness: "2m ago",
        count: satellites.length,
        isLive: true
      },
      {
        name: "Conjunctions",
        source: "Space-Track",
        freshness: "2m ago",
        count: conjunctions.length,
        isLive: true
      },
      {
        name: "Space Weather",
        source: "NOAA SWPC",
        freshness: "2m ago",
        count: 1,
        isLive: true
      },
      {
        name: "Aurora Forecast",
        source: "NOAA Ovation",
        freshness: "2m ago",
        count: 2,
        isLive: true
      }
    ],
    [conjunctions.length, satellites.length]
  );

  return (
    <div className="pointer-events-none absolute inset-0 p-4 font-mono text-[13px] text-[var(--aurora-text)]">
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
          <p className="text-xs tracking-[0.2em] text-[var(--aurora-accent)]">SPACE WEATHER</p>
          <div className="mt-2 flex items-end gap-3">
            <p className="text-2xl font-semibold" style={{ color: getKpColor(spaceWeather.kpIndex) }}>
              Kp {spaceWeather.kpIndex.toFixed(1)}
            </p>
            <span className="rounded border border-white/20 px-2 py-0.5 text-xs uppercase tracking-[0.12em]">
              {spaceWeather.stormLevel}
            </span>
          </div>
          <div className="relative mt-2 h-2 w-full overflow-hidden rounded bg-gradient-to-r from-[#6dff79] via-[#ffcb3b] to-[#ff2a2a]">
            <div className="absolute -top-1 h-4 w-[2px] bg-white" style={{ left: `calc(${kpPosition}% - 1px)` }} />
          </div>

          <div className="mt-3 space-y-1 text-xs text-[#cde4f6]">
            <div className="flex justify-between">
              <span>Solar Wind Speed</span>
              <span>{spaceWeather.solarWindSpeed} km/s</span>
            </div>
            <div className="flex justify-between">
              <span>Solar Wind Density</span>
              <span>{spaceWeather.solarWindDensity.toFixed(1)} p/cm</span>
            </div>
            <div className="flex justify-between">
              <span>Bz Component</span>
              <span className={spaceWeather.bzComponent < 0 ? "text-[#ff4f4f]" : "text-[#7dff6a]"}>
                {spaceWeather.bzComponent.toFixed(1)} nT
              </span>
            </div>
            <div className="flex justify-between">
              <span>X-ray Flux</span>
              <span>{spaceWeather.xrayFlux}</span>
            </div>
          </div>
        </div>

        <div className="hud-panel pointer-events-auto ml-auto w-[430px] self-start rounded p-3">
          <p className="text-xs tracking-[0.2em] text-[var(--aurora-accent)]">ACTIVE ALERTS</p>
          <div className="mt-2 space-y-1 text-xs text-[#d8ebff]">
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
                    {conjunction.object1.name} - {conjunction.object2.name} | TCA {formatDurationToTca(conjunction.tca)} | Pc{" "}
                    {formatProbability(conjunction.probability)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

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
          <p className="text-xs tracking-[0.2em] text-[var(--aurora-accent)]">DATA LAYERS</p>
          <div className="mt-2 space-y-1 text-xs">
            {layers.map((layer) => (
              <div key={layer.name} className="grid grid-cols-[8px_1.2fr_1fr_0.8fr_0.6fr] items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${layer.isLive ? "bg-[#00ff88]" : "bg-[#7a8896]"}`} />
                <span>{layer.name}</span>
                <span className="text-[#9ec3df]">{layer.source}</span>
                <span>{layer.freshness}</span>
                <span className="text-right">{layer.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="ml-auto mt-auto self-end text-right">
          <div className="hud-panel pointer-events-auto inline-block rounded px-4 py-2">
            <p className="text-lg tracking-[0.25em] text-[var(--aurora-accent)]">AURORA</p>
            <p className="text-xs text-[#b9d6ee]">{formatUtcTime(now)}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
