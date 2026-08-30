import { type ChangeEvent, useEffect, useState } from "react";

import { useAuroraStore } from "../../store/auroraStore";
import { bzMagnetosphereLabel, isBzSouthward } from "../../utils/bzComponent";
import { getKpColor } from "../../utils/colors";
import { formatHelioArrivalLabel, isHelioCmeImminent } from "../../utils/helio";
import {
  burstIntensityToPercent,
  helioPlaybackLabel,
  percentToBurstIntensity
} from "../../utils/helioControls";
import { formatKpIndex, formatMagneticFieldNt } from "../../utils/measurements";

interface HelioRowProps {
  color: string;
  label: string;
  value: string;
  pulse?: boolean;
}

const HelioRow = ({ color, label, value, pulse = false }: HelioRowProps): JSX.Element => (
  <div className="flex items-center justify-between gap-5 text-[11px] text-[#a8c7de]">
    <div className="flex items-center gap-2">
      <span
        className={`h-2 w-2 rounded-full ${pulse ? "animate-pulse" : ""}`}
        style={{ backgroundColor: color, boxShadow: `0 0 10px ${color}` }}
      />
      <span className="tracking-[0.16em] text-[#7d9cb5]">{label}</span>
    </div>
    <span className="text-right text-[#e7f5ff]">{value}</span>
  </div>
);

export const HelioOverlay = (): JSX.Element | null => {
  const currentMode = useAuroraStore((state) => state.currentMode);
  const spaceWeather = useAuroraStore((state) => state.spaceWeather);
  const helioSimulationSeconds = useAuroraStore((state) => state.helioSimulationSeconds);
  const helioPlaybackRate = useAuroraStore((state) => state.helioPlaybackRate);
  const helioSelectedPlaybackRate = useAuroraStore((state) => state.helioSelectedPlaybackRate);
  const helioBurstIntensity = useAuroraStore((state) => state.helioBurstIntensity);
  const toggleHelioPlayback = useAuroraStore((state) => state.toggleHelioPlayback);
  const setHelioSelectedPlaybackRate = useAuroraStore((state) => state.setHelioSelectedPlaybackRate);
  const setHelioBurstIntensity = useAuroraStore((state) => state.setHelioBurstIntensity);
  const resetHelioSimulation = useAuroraStore((state) => state.resetHelioSimulation);
  const newHelioSimulation = useAuroraStore((state) => state.newHelioSimulation);
  const helioScenarioVersion = useAuroraStore((state) => state.helioScenarioVersion);

  const [newSimNotification, setNewSimNotification] = useState<string | null>(null);

  // Show flash notification on NEW SIM
  useEffect(() => {
    if (helioScenarioVersion > 0 && currentMode === "HELIO") {
      setNewSimNotification("NEW CME EVENT GENERATED");
      const timer = setTimeout(() => setNewSimNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [helioScenarioVersion, currentMode]);

  if (currentMode !== "HELIO") {
    return null;
  }

  const isCmeImminent = isHelioCmeImminent(helioSimulationSeconds);
  const bzColor = isBzSouthward(spaceWeather.bzComponent) ? "#ff5a5a" : "#7dff6a";
  const kpColor = getKpColor(spaceWeather.kpIndex);
  const playbackLabel = helioPlaybackLabel(helioPlaybackRate, helioSelectedPlaybackRate);
  const intensityPercent = burstIntensityToPercent(helioBurstIntensity);

  // Bz shield status shares the Bz readout colour and adds a magnetosphere label.
  const bzShieldLabel = bzMagnetosphereLabel(spaceWeather.bzComponent);

  const handleSpeedChange = (event: ChangeEvent<HTMLInputElement>): void => {
    setHelioSelectedPlaybackRate(Number(event.currentTarget.value));
  };

  const handleIntensityChange = (event: ChangeEvent<HTMLInputElement>): void => {
    setHelioBurstIntensity(percentToBurstIntensity(Number(event.currentTarget.value)));
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-[65]">
      <div className="absolute left-4 top-4 min-w-[280px] rounded border border-cyan-400/20 bg-[linear-gradient(180deg,rgba(7,18,34,0.9),rgba(3,10,20,0.82))] px-4 py-3 font-mono shadow-[0_0_30px_rgba(0,180,255,0.08)] backdrop-blur-md">
        <p className="text-xs tracking-[0.28em] text-[#00d4ff]" style={{ textShadow: "0 0 10px rgba(0,212,255,0.32)" }}>
          HELIOCENTRIC VIEW
        </p>
        <div className="mt-2 h-px w-full bg-[repeating-linear-gradient(90deg,rgba(0,212,255,0.4)_0_10px,rgba(0,212,255,0.08)_10px_18px)]" />
        <div className="mt-3 space-y-2">
          <HelioRow color="#00d4ff" label="SOLAR WIND @ L1" value={`${spaceWeather.solarWindSpeed} km/s`} />
          <HelioRow color={bzColor} label="BZ COMPONENT" value={formatMagneticFieldNt(spaceWeather.bzComponent)} />
          <HelioRow color={kpColor} label="KP INDEX" value={formatKpIndex(spaceWeather.kpIndex)} />
          <HelioRow color="#ff9a32" label="CME ARRIVAL" value={formatHelioArrivalLabel(helioSimulationSeconds)} pulse={isCmeImminent} />
          <HelioRow color={bzColor} label="MAGNETOSPHERE" value={bzShieldLabel} />
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-cyan-500/10 pt-2 text-[10px] tracking-[0.18em] text-[#6d8ea9]">
          <span>VIEW WIDTH ~ 2.0 AU</span>
          <span>{playbackLabel}</span>
        </div>
        <div className="pointer-events-auto mt-3 flex gap-2">
          <button
            type="button"
            onClick={toggleHelioPlayback}
            className="rounded border border-cyan-400/25 bg-[rgba(0,212,255,0.08)] px-3 py-1 text-[10px] tracking-[0.18em] text-[#d8f8ff] transition-colors hover:bg-[rgba(0,212,255,0.14)]"
          >
            {helioPlaybackRate === 0 ? "PLAY SIM" : "PAUSE SIM"}
          </button>
          <button
            type="button"
            onClick={newHelioSimulation}
            className="rounded border border-orange-400/25 bg-[rgba(255,140,0,0.08)] px-3 py-1 text-[10px] tracking-[0.18em] text-[#ffd5a0] transition-colors hover:bg-[rgba(255,140,0,0.14)]"
          >
            NEW SIM
          </button>
          <button
            type="button"
            onClick={resetHelioSimulation}
            className="rounded border border-slate-400/20 bg-[rgba(148,163,184,0.08)] px-3 py-1 text-[10px] tracking-[0.18em] text-[#d4deeb] transition-colors hover:bg-[rgba(148,163,184,0.14)]"
          >
            RESET
          </button>
        </div>
        <div className="pointer-events-auto mt-3 space-y-3 border-t border-cyan-500/10 pt-3">
          <div>
            <div className="mb-1 flex items-center justify-between text-[10px] tracking-[0.18em] text-[#7d9cb5]">
              <span>SIM SPEED</span>
              <span className="text-[#dff8ff]">{helioSelectedPlaybackRate}x</span>
            </div>
            <input
              type="range"
              min="1"
              max="2000"
              step="1"
              value={helioSelectedPlaybackRate}
              onChange={handleSpeedChange}
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-[linear-gradient(90deg,rgba(0,212,255,0.35),rgba(0,212,255,0.08))]"
            />
            <div className="mt-1 flex items-center justify-between text-[9px] tracking-[0.16em] text-[#5f7c95]">
              <span>1x</span>
              <span>2000x</span>
            </div>
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between text-[10px] tracking-[0.18em] text-[#7d9cb5]">
              <span>BURST INTENSITY</span>
              <span className="text-[#ffd7a4]">{intensityPercent}%</span>
            </div>
            <input
              type="range"
              min="25"
              max="300"
              step="5"
              value={intensityPercent}
              onChange={handleIntensityChange}
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-[linear-gradient(90deg,rgba(255,120,0,0.38),rgba(255,120,0,0.08))]"
            />
            <div className="mt-1 flex items-center justify-between text-[9px] tracking-[0.16em] text-[#7f715f]">
              <span>25%</span>
              <span>300%</span>
            </div>
          </div>
        </div>

        {/* L1 DSCOVR Data */}
        <div className="mt-3 border-t border-cyan-500/10 pt-2">
          <p className="text-[9px] tracking-[0.18em] text-[#00d4ff80]">L1 DSCOVR READINGS</p>
          <div className="mt-1 space-y-0.5 text-[10px]">
            <div className="flex justify-between">
              <span className="text-[#6d8ea9]">Solar Wind</span>
              <span className="text-[#e7f5ff]">{spaceWeather.solarWindSpeed} km/s</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#6d8ea9]">Density</span>
              <span className="text-[#e7f5ff]">{spaceWeather.solarWindDensity} p/cm³</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#6d8ea9]">Bz</span>
              <span style={{ color: bzColor }}>{formatMagneticFieldNt(spaceWeather.bzComponent)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* New SIM notification flash */}
      {newSimNotification && (
        <div className="absolute left-1/2 top-4 -translate-x-1/2 rounded border border-orange-400/40 bg-[rgba(80,40,0,0.9)] px-4 py-2 font-mono backdrop-blur-sm transition-opacity duration-500">
          <p className="text-[12px] tracking-[0.15em] text-[#ffd080]">{newSimNotification}</p>
        </div>
      )}

      <div className="absolute bottom-24 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded border border-cyan-500/15 bg-[rgba(5,15,30,0.55)] px-3 py-1 font-mono text-[10px] tracking-[0.18em] text-[#7ba5c5] backdrop-blur-sm">
        <span className="rounded border border-cyan-400/30 bg-[rgba(0,212,255,0.08)] px-2 py-0.5 text-[#d8f8ff] shadow-[0_0_14px_rgba(0,212,255,0.08)]">
          [ 1 ]
        </span>
        <span>PRESS TO RETURN</span>
      </div>
    </div>
  );
};
