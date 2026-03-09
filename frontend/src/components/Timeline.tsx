import { useCallback, useEffect, useRef, useState } from "react";

import { historicalEvents } from "../data/mock/historicalEvents";
import { useAuroraStore } from "../store/auroraStore";
import type { HistoricalEvent } from "../types/space";

const TIMELINE_START = new Date("2003-01-01T00:00:00Z");
const TIMELINE_END = new Date();

const dateToFraction = (date: Date): number => {
  const total = TIMELINE_END.getTime() - TIMELINE_START.getTime();
  const offset = date.getTime() - TIMELINE_START.getTime();
  return Math.max(0, Math.min(1, offset / total));
};

const fractionToDate = (fraction: number): Date => {
  const total = TIMELINE_END.getTime() - TIMELINE_START.getTime();
  return new Date(TIMELINE_START.getTime() + fraction * total);
};

const formatTimelineDate = (date: Date): string => {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const getMarkerColor = (event: HistoricalEvent): string => {
  if (event.type === "solar_storm") return "#ff6622";
  if (event.type === "conjunction") return "#ff2222";
  return "#ff4488";
};

const getMarkerShape = (event: HistoricalEvent): "dot" | "x" => {
  if (event.type === "conjunction") return "x";
  return "dot";
};

export const Timeline = (): JSX.Element | null => {
  const timelineActive = useAuroraStore((s) => s.timelineActive);
  const setTimelineActive = useAuroraStore((s) => s.setTimelineActive);
  const timelinePosition = useAuroraStore((s) => s.timelinePosition);
  const setTimelinePosition = useAuroraStore((s) => s.setTimelinePosition);
  const timelineEvent = useAuroraStore((s) => s.timelineEvent);
  const setTimelineEvent = useAuroraStore((s) => s.setTimelineEvent);
  const setMode = useAuroraStore((s) => s.setMode);

  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hoveredEvent, setHoveredEvent] = useState<HistoricalEvent | null>(null);
  const [tooltipX, setTooltipX] = useState(0);

  const isLive = !timelineEvent && Math.abs(timelinePosition.getTime() - Date.now()) < 60_000;

  // Toggle timeline with T key
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "t" || e.key === "T") {
        setTimelineActive(!timelineActive);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [timelineActive, setTimelineActive]);

  const updatePositionFromPointer = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      const fraction = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const date = fractionToDate(fraction);
      setTimelinePosition(date);

      // Find the nearest event within a tolerance
      const tolerance = 0.015;
      let nearest: HistoricalEvent | null = null;
      let nearestDist = Infinity;
      for (const event of historicalEvents) {
        const ef = dateToFraction(event.date);
        const dist = Math.abs(ef - fraction);
        if (dist < tolerance && dist < nearestDist) {
          nearest = event;
          nearestDist = dist;
        }
      }

      if (nearest) {
        setTimelineEvent(nearest);
        // Auto-switch mode based on event
        if (nearest.kpIndex !== undefined && nearest.kpIndex > 5) {
          setMode("STORM");
        } else {
          setMode("OPS");
        }
      } else {
        setTimelineEvent(null);
        setMode("OPS");
      }
    },
    [setTimelinePosition, setTimelineEvent, setMode]
  );

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      setIsDragging(true);
      updatePositionFromPointer(e.clientX);
    },
    [updatePositionFromPointer]
  );

  useEffect(() => {
    if (!isDragging) return;

    const onMouseMove = (e: MouseEvent) => {
      updatePositionFromPointer(e.clientX);
    };

    const onMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [isDragging, updatePositionFromPointer]);

  const goLive = useCallback(() => {
    setTimelinePosition(new Date());
    setTimelineEvent(null);
    setMode("OPS");
  }, [setTimelinePosition, setTimelineEvent, setMode]);

  if (!timelineActive) return null;

  const currentFraction = dateToFraction(timelinePosition);

  // Year tick marks
  const startYear = TIMELINE_START.getUTCFullYear();
  const endYear = TIMELINE_END.getUTCFullYear();
  const yearTicks: { year: number; fraction: number }[] = [];
  for (let y = startYear; y <= endYear; y += 2) {
    const d = new Date(`${y}-01-01T00:00:00Z`);
    yearTicks.push({ year: y, fraction: dateToFraction(d) });
  }

  return (
    <div className="pointer-events-auto fixed bottom-16 left-4 right-4 z-[90]">
      {/* Historical playback banner */}
      {!isLive && (
        <div className="mb-2 text-center">
          <span className="inline-block rounded border border-amber-500/40 bg-amber-950/60 px-3 py-1 font-mono text-[11px] tracking-[0.15em] text-amber-300">
            HISTORICAL PLAYBACK - {formatTimelineDate(timelinePosition)}
            {timelineEvent && ` - ${timelineEvent.name}`}
          </span>
        </div>
      )}

      <div className="rounded border border-cyan-500/20 bg-[rgba(5,15,30,0.92)] px-4 py-3 backdrop-blur-md">
        <div className="mb-1 flex items-center justify-between">
          <span className="font-mono text-[10px] tracking-[0.15em] text-[#6b8fa8]">TIMELINE</span>
          <div className="flex items-center gap-3">
            <span className="font-mono text-[10px] text-[#9cc2de]">
              {formatTimelineDate(timelinePosition)}
            </span>
            <button
              type="button"
              onClick={goLive}
              className={`rounded border px-2 py-0.5 font-mono text-[10px] tracking-[0.1em] transition-colors ${
                isLive
                  ? "border-green-500/50 bg-green-900/40 text-green-400"
                  : "border-cyan-500/30 bg-cyan-900/20 text-cyan-300 hover:bg-cyan-900/40"
              }`}
            >
              {isLive ? "LIVE" : "GO LIVE"}
            </button>
          </div>
        </div>

        {/* Track */}
        <div
          ref={trackRef}
          className="relative h-10 cursor-crosshair select-none"
          onMouseDown={onMouseDown}
        >
          {/* Background track line */}
          <div className="absolute left-0 right-0 top-[18px] h-[2px] bg-[#1a3050]" />

          {/* Year ticks */}
          {yearTicks.map((tick) => (
            <div
              key={tick.year}
              className="absolute top-[12px]"
              style={{ left: `${tick.fraction * 100}%` }}
            >
              <div className="h-[14px] w-[1px] bg-[#1a3050]" />
              <span className="absolute top-[16px] -translate-x-1/2 font-mono text-[8px] text-[#4a6b83]">
                {tick.year}
              </span>
            </div>
          ))}

          {/* Event markers */}
          {historicalEvents.map((event) => {
            const fraction = dateToFraction(event.date);
            const color = getMarkerColor(event);
            const shape = getMarkerShape(event);
            const isActive = timelineEvent?.id === event.id;

            return (
              <div
                key={event.id}
                className="absolute top-[14px] -translate-x-1/2 cursor-pointer"
                style={{ left: `${fraction * 100}%` }}
                onMouseEnter={(e) => {
                  setHoveredEvent(event);
                  setTooltipX(e.clientX);
                }}
                onMouseLeave={() => setHoveredEvent(null)}
              >
                {shape === "dot" ? (
                  <div
                    className="h-[10px] w-[10px] rounded-full"
                    style={{
                      backgroundColor: color,
                      boxShadow: isActive ? `0 0 8px ${color}, 0 0 16px ${color}` : `0 0 4px ${color}80`,
                      transform: isActive ? "scale(1.4)" : "scale(1)",
                      transition: "transform 200ms, box-shadow 200ms"
                    }}
                  />
                ) : (
                  <span
                    className="block text-center font-mono text-[14px] font-bold leading-none"
                    style={{
                      color,
                      textShadow: isActive ? `0 0 8px ${color}` : "none",
                      transform: isActive ? "scale(1.4)" : "scale(1)",
                      transition: "transform 200ms"
                    }}
                  >
                    X
                  </span>
                )}
              </div>
            );
          })}

          {/* Current position indicator */}
          <div
            className="absolute top-[8px] -translate-x-1/2"
            style={{ left: `${currentFraction * 100}%` }}
          >
            <div
              className="h-[22px] w-[2px] bg-[#00d4ff]"
              style={{ boxShadow: "0 0 6px rgba(0,212,255,0.5)" }}
            />
          </div>
        </div>

        {/* Tooltip */}
        {hoveredEvent && (
          <div
            className="pointer-events-none fixed z-[200] -translate-x-1/2 -translate-y-full rounded border border-cyan-500/30 bg-[rgba(5,15,30,0.95)] px-3 py-2 backdrop-blur-md"
            style={{ left: tooltipX, top: trackRef.current ? trackRef.current.getBoundingClientRect().top - 8 : 0 }}
          >
            <p className="font-mono text-[11px] font-semibold text-white">{hoveredEvent.name}</p>
            <p className="mt-0.5 font-mono text-[10px] text-[#9cc2de]">
              {formatTimelineDate(hoveredEvent.date)}
            </p>
            <p className="mt-1 max-w-[280px] font-mono text-[9px] leading-relaxed text-[#7ca2bf]">
              {hoveredEvent.description}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
