import { useEffect, useState } from "react";

import { useAuroraStore } from "../../store/auroraStore";
import { resolveDisplayedWeather } from "../../utils/displayedWeather";
import { formatKpIndex } from "../../utils/measurements";
import { kpToGScale } from "../../utils/spaceWeatherScales";
import { buildStormOverlayStyle } from "../../utils/stormOverlayStyle";
import { isStormModeActive } from "../../utils/visualMode";

export const StormOverlay = (): JSX.Element | null => {
  const currentMode = useAuroraStore((s) => s.currentMode);
  const spaceWeather = useAuroraStore((s) => s.spaceWeather);
  const timelineEvent = useAuroraStore((s) => s.timelineEvent);
  const stormAutoTriggered = useAuroraStore((s) => s.stormAutoTriggered);
  const setStormAutoTriggered = useAuroraStore((s) => s.setStormAutoTriggered);
  const setMode = useAuroraStore((s) => s.setMode);
  const [visible, setVisible] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const { kpIndex: kp, stormLevel } = resolveDisplayedWeather(spaceWeather, timelineEvent);
  const isStormActive = isStormModeActive(currentMode, kp);

  // Auto-trigger STORM mode when kp > 5
  useEffect(() => {
    if (kp > 5 && currentMode !== "STORM") {
      setMode("STORM");
      setStormAutoTriggered(true);
      setBannerDismissed(false);
    }
  }, [kp, currentMode, setMode, setStormAutoTriggered]);

  useEffect(() => {
    if (isStormActive) {
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
    }
  }, [isStormActive]);

  // Reset banner dismissed when leaving storm mode
  useEffect(() => {
    if (currentMode !== "STORM") {
      setBannerDismissed(false);
    }
  }, [currentMode]);

  if (!isStormActive && !visible) return null;

  const { vignetteShadow, banner } = buildStormOverlayStyle(kp);

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[60] transition-opacity duration-400"
      style={{ opacity: visible ? 1 : 0 }}
    >
      {/* Red vignette */}
      <div className="absolute inset-0" style={{ boxShadow: vignetteShadow }} />

      {/* Storm banner */}
      <div className="absolute left-0 right-0 top-0 flex justify-center pt-3">
        <div
          className="rounded border px-4 py-1.5 font-mono text-[11px] tracking-[0.2em]"
          style={{ ...banner, animation: "storm-pulse 2s ease-in-out infinite" }}
        >
          GEOMAGNETIC STORM ACTIVE - {stormLevel.toUpperCase()} ({kpToGScale(kp)}) - Kp {formatKpIndex(kp)}
        </div>
      </div>

      {/* Auto-trigger banner */}
      {stormAutoTriggered && !bannerDismissed && currentMode === "STORM" && (
        <div className="pointer-events-auto absolute left-0 right-0 top-12 flex justify-center pt-2">
          <div className="flex items-center gap-3 rounded border border-red-500/40 bg-[rgba(80,10,0,0.8)] px-4 py-2 font-mono text-[11px] tracking-[0.15em] text-[#ffaa66] backdrop-blur-sm">
            <span>STORM MODE AUTO-ACTIVATED — Kp {formatKpIndex(kp)} detected</span>
            <button
              type="button"
              onClick={() => setBannerDismissed(true)}
              className="rounded border border-white/20 px-2 py-0.5 text-[10px] text-white/60 hover:bg-white/10 hover:text-white"
            >
              DISMISS
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
