import { useCallback, useEffect, useRef, useState } from "react";

import { useAuroraStore } from "../store/auroraStore";
import type { VisualMode } from "../types/space";

const MODES: { key: VisualMode; label: string; subtitle: string; shortcut: string }[] = [
  { key: "OPS", label: "OPS", subtitle: "Operator Dashboard", shortcut: "1" },
  { key: "STORM", label: "STORM", subtitle: "Weather Response", shortcut: "2" },
  { key: "INTEL", label: "INTEL", subtitle: "Conjunction Analysis", shortcut: "3" },
  { key: "HELIO", label: "HELIO", subtitle: "Solar Forecasting", shortcut: "4" }
];

export const ModeSelector = (): JSX.Element => {
  const currentMode = useAuroraStore((s) => s.currentMode);
  const setMode = useAuroraStore((s) => s.setMode);
  const closeAllPanels = useAuroraStore((s) => s.closeAllPanels);
  const [glitch, setGlitch] = useState(false);
  const underlineRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<Map<VisualMode, HTMLButtonElement>>(new Map());

  const handleSetMode = useCallback(
    (mode: VisualMode) => {
      if (mode === currentMode) return;
      setGlitch(true);
      setTimeout(() => setGlitch(false), 80);
      setMode(mode);
    },
    [currentMode, setMode]
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "Escape") {
        closeAllPanels();
        return;
      }
      const index = parseInt(e.key, 10);
      if (index >= 1 && index <= 4) {
        handleSetMode(MODES[index - 1].key);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleSetMode, closeAllPanels]);

  // Update underline position
  useEffect(() => {
    const activeBtn = buttonRefs.current.get(currentMode);
    const underline = underlineRef.current;
    if (activeBtn && underline) {
      const parent = activeBtn.parentElement;
      if (parent) {
        const parentRect = parent.getBoundingClientRect();
        const btnRect = activeBtn.getBoundingClientRect();
        underline.style.left = `${btnRect.left - parentRect.left}px`;
        underline.style.width = `${btnRect.width}px`;
      }
    }
  }, [currentMode]);

  return (
    <>
      {/* Glitch flash overlay */}
      {glitch && (
        <div className="pointer-events-none fixed inset-0 z-[200] bg-white/10" />
      )}

      <div className="pointer-events-auto fixed bottom-6 left-1/2 z-[100] -translate-x-1/2">
        <div className="relative flex gap-1 rounded border border-cyan-500/20 bg-[rgba(5,15,30,0.9)] px-1 py-1 backdrop-blur-md">
          {MODES.map((mode) => {
            const isActive = currentMode === mode.key;
            return (
              <button
                key={mode.key}
                ref={(el) => {
                  if (el) buttonRefs.current.set(mode.key, el);
                }}
                type="button"
                onClick={() => handleSetMode(mode.key)}
                className={`relative px-4 py-1.5 font-mono text-xs tracking-[0.18em] transition-all duration-300 ${
                  isActive
                    ? "text-[#00d4ff]"
                    : "text-[#6b8fa8] hover:text-[#a0c8e0]"
                }`}
                style={
                  isActive
                    ? {
                        textShadow: "0 0 8px rgba(0,212,255,0.6), 0 0 20px rgba(0,212,255,0.2)"
                      }
                    : undefined
                }
              >
                <span className="relative z-10 flex flex-col items-center">
                  <span className="flex items-center gap-1">
                    {mode.label}
                    <span className="text-[9px] opacity-40">{mode.shortcut}</span>
                  </span>
                  <span className="text-[7px] opacity-50 tracking-[0.1em]">{mode.subtitle}</span>
                </span>
              </button>
            );
          })}
          {/* Animated underline */}
          <div
            ref={underlineRef}
            className="absolute bottom-0 h-[2px] bg-[#00d4ff] transition-all duration-400 ease-out"
            style={{ boxShadow: "0 0 8px rgba(0,212,255,0.5), 0 0 16px rgba(0,212,255,0.2)" }}
          />
        </div>
      </div>
    </>
  );
};
