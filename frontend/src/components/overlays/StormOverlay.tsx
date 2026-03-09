import { useEffect, useState } from "react";

import { useAuroraStore } from "../../store/auroraStore";

export const StormOverlay = (): JSX.Element | null => {
  const currentMode = useAuroraStore((s) => s.currentMode);
  const spaceWeather = useAuroraStore((s) => s.spaceWeather);
  const timelineEvent = useAuroraStore((s) => s.timelineEvent);
  const [visible, setVisible] = useState(false);

  const kp = timelineEvent?.kpIndex ?? spaceWeather.kpIndex;
  const stormLevel = timelineEvent?.stormLevel ?? spaceWeather.stormLevel;
  const isStormActive = currentMode === "STORM" || kp > 5;

  useEffect(() => {
    if (isStormActive) {
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
    }
  }, [isStormActive]);

  if (!isStormActive && !visible) return null;

  const intensity = Math.min(1, (kp - 4) / 5);

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[60] transition-opacity duration-400"
      style={{ opacity: visible ? 1 : 0 }}
    >
      {/* Red vignette */}
      <div
        className="absolute inset-0"
        style={{
          boxShadow: `inset 0 0 ${80 + intensity * 120}px ${20 + intensity * 40}px rgba(255,${Math.round(30 + (1 - intensity) * 40)},0,${0.15 + intensity * 0.2})`
        }}
      />

      {/* Storm banner */}
      <div className="absolute left-0 right-0 top-0 flex justify-center pt-3">
        <div
          className="rounded border px-4 py-1.5 font-mono text-[11px] tracking-[0.2em]"
          style={{
            borderColor: `rgba(255,${Math.round(60 + (1 - intensity) * 80)},0,0.6)`,
            backgroundColor: `rgba(80,10,0,${0.5 + intensity * 0.3})`,
            color: `rgb(255,${Math.round(120 + (1 - intensity) * 60)},${Math.round(60 + (1 - intensity) * 40)})`,
            textShadow: `0 0 10px rgba(255,60,0,${0.4 + intensity * 0.3})`,
            animation: "storm-pulse 2s ease-in-out infinite"
          }}
        >
          GEOMAGNETIC STORM ACTIVE - {stormLevel.toUpperCase()} - Kp {kp.toFixed(1)}
        </div>
      </div>
    </div>
  );
};
