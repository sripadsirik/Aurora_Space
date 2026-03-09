import { useEffect, useRef, useState } from "react";

import { useAuroraStore } from "../../store/auroraStore";

const formatUtcFull = (d: Date): string => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} UTC`;
};

export const IntelOverlay = (): JSX.Element | null => {
  const currentMode = useAuroraStore((s) => s.currentMode);
  const [visible, setVisible] = useState(false);
  const [recBlink, setRecBlink] = useState(true);
  const [flickerOpacity, setFlickerOpacity] = useState(1);
  const [utcTime, setUtcTime] = useState(formatUtcFull(new Date()));
  const flickerRef = useRef<ReturnType<typeof setInterval>>();
  const recRef = useRef<ReturnType<typeof setInterval>>();
  const timeRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    if (currentMode === "INTEL") {
      requestAnimationFrame(() => setVisible(true));

      // Flicker effect
      flickerRef.current = setInterval(() => {
        setFlickerOpacity(0.97 + Math.random() * 0.03);
      }, 100 + Math.random() * 100);

      // REC blink
      recRef.current = setInterval(() => {
        setRecBlink((prev) => !prev);
      }, 800);

      // UTC clock
      timeRef.current = setInterval(() => {
        setUtcTime(formatUtcFull(new Date()));
      }, 1000);
    } else {
      setVisible(false);
    }

    return () => {
      if (flickerRef.current) clearInterval(flickerRef.current);
      if (recRef.current) clearInterval(recRef.current);
      if (timeRef.current) clearInterval(timeRef.current);
    };
  }, [currentMode]);

  if (currentMode !== "INTEL" && !visible) return null;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[60] transition-opacity duration-400"
      style={{ opacity: visible ? flickerOpacity : 0 }}
    >
      {/* Scanlines */}
      <div
        className="absolute inset-0"
        style={{
          background: "repeating-linear-gradient(0deg, rgba(0,0,0,0.15) 0px, rgba(0,0,0,0.15) 1px, transparent 1px, transparent 3px)",
          pointerEvents: "none"
        }}
      />

      {/* Green phosphor tint */}
      <div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(ellipse at center, rgba(0,255,68,0.03) 0%, rgba(0,255,68,0.06) 50%, rgba(0,80,20,0.12) 100%)",
          mixBlendMode: "screen"
        }}
      />

      {/* Vignette */}
      <div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.5) 100%)"
        }}
      />

      {/* Barrel distortion (subtle perspective) on the globe */}
      <style>{`
        .cesium-viewer, .cesium-viewer-cesiumWidget, .cesium-widget {
          transform: perspective(2000px) scale(1.02);
          transform-origin: center center;
        }
      `}</style>

      {/* Classification banner */}
      <div className="absolute left-0 right-0 top-0 flex justify-center pt-2">
        <span
          className="font-mono text-[10px] tracking-[0.25em]"
          style={{ color: "#00ff44", textShadow: "0 0 6px rgba(0,255,68,0.4)" }}
        >
          TOP SECRET // SPACE SITUATIONAL AWARENESS // NOFORN
        </span>
      </div>

      {/* REC indicator */}
      <div className="absolute right-4 top-3 flex items-center gap-2">
        <span
          className="inline-block h-[8px] w-[8px] rounded-full"
          style={{
            backgroundColor: recBlink ? "#ff0000" : "transparent",
            boxShadow: recBlink ? "0 0 6px rgba(255,0,0,0.6)" : "none"
          }}
        />
        <span
          className="font-mono text-[10px] tracking-[0.15em]"
          style={{ color: "#00ff44", textShadow: "0 0 4px rgba(0,255,68,0.3)" }}
        >
          REC
        </span>
        <span
          className="ml-2 font-mono text-[10px]"
          style={{ color: "#00ff44", opacity: 0.7 }}
        >
          {utcTime}
        </span>
      </div>
    </div>
  );
};
