import { useEffect, useState } from "react";

import { useAuroraStore } from "../../store/auroraStore";
import { formatHelioArrivalLabel } from "../../utils/helio";

export const HelioOverlay = (): JSX.Element | null => {
  const currentMode = useAuroraStore((state) => state.currentMode);
  const spaceWeather = useAuroraStore((state) => state.spaceWeather);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (currentMode !== "HELIO") {
      setElapsedSeconds(0);
      return;
    }

    const startedAt = performance.now();
    const timer = window.setInterval(() => {
      setElapsedSeconds((performance.now() - startedAt) / 1000);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [currentMode]);

  if (currentMode !== "HELIO") {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-[65]">
      <div className="absolute left-4 top-4 rounded border border-cyan-500/20 bg-[rgba(5,15,30,0.72)] px-4 py-3 font-mono backdrop-blur-md">
        <p className="text-xs tracking-[0.25em] text-[#00d4ff]" style={{ textShadow: "0 0 8px rgba(0,212,255,0.25)" }}>
          HELIOCENTRIC VIEW
        </p>
        <div className="mt-3 space-y-1 text-[11px] text-[#9cc2de]">
          <p>Solar Wind @ L1: {spaceWeather.solarWindSpeed} km/s</p>
          <p>Bz Component: {spaceWeather.bzComponent.toFixed(1)} nT</p>
          <p>Kp Index: {spaceWeather.kpIndex.toFixed(1)}</p>
          <p>CME Arrival: {formatHelioArrivalLabel(elapsedSeconds)}</p>
        </div>
      </div>

      <div className="absolute bottom-24 left-1/2 -translate-x-1/2 rounded border border-cyan-500/15 bg-[rgba(5,15,30,0.55)] px-3 py-1 font-mono text-[10px] tracking-[0.15em] text-[#7ba5c5] backdrop-blur-sm">
        PRESS 1 TO RETURN
      </div>
    </div>
  );
};
