import { useAerospace } from "../aerospace/store";
import { useEarth } from "../earth/store";
import { useEffect, useId, useRef, useState } from "react";
import { useUtcClock } from "../hooks/useUtcClock";
import { useAuroraStore } from "../store/auroraStore";
import { getDataStatus } from "../utils/dataStatus";
import { FeedSummary } from "./FeedSummary";
const statusColor = {
  demo: "border-amber-400/50 bg-amber-950/70 text-amber-200",
  mixed: "border-amber-400/50 bg-amber-950/70 text-amber-200",
  live: "border-emerald-400/50 bg-emerald-950/70 text-emerald-200",
  stale: "border-orange-400/50 bg-orange-950/70 text-orange-200",
  offline: "border-red-400/50 bg-red-950/70 text-red-200",
} as const;
export function DataStatusIndicator() {
  const now = useUtcClock(),
    connected = useAuroraStore((s) => s.isConnectedToBackend),
    times = useAuroraStore((s) => s.feedLastUpdated),
    openPanel = useAuroraStore((s) => s.openPanel);
  const air = useAerospace(),
    earth = useEarth();
  const base = getDataStatus(connected, times, now);
  const extras = [];
  if (
    air.aircraftOn &&
    (air.feedInfo.aircraft.error || air.feedInfo.aircraft.stale)
  )
    extras.push("aircraft");
  if (
    air.launchesOn &&
    (air.feedInfo.launches.error || air.feedInfo.launches.stale)
  )
    extras.push("launches");
  if (
    air.followedLaunchId &&
    (air.rocketTelemetry.status === "unavailable" ||
      air.rocketTelemetry.status === "stale")
  )
    extras.push("rocket telemetry");
  if (earth.camerasOn && earth.feed.error) extras.push("traffic cameras");
  const { status, label, detail } =
    base.status === "live" && extras.length
      ? {
          status: "stale" as const,
          label: "PARTIAL FEED OUTAGE",
          detail: `Unavailable or stale: ${extras.join(", ")}. Cached records retain their original source times.`,
        }
      : base;
  const [hovered, setHovered] = useState(false),
    [pinned, setPinned] = useState(false),
    [focused, setFocused] = useState(false);
  const root = useRef<HTMLDivElement>(null),
    id = useId(),
    visible = hovered || pinned || focused;
  useEffect(() => {
    if (!visible) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) {
        setPinned(false);
        setHovered(false);
        setFocused(false);
      }
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPinned(false);
        setHovered(false);
        setFocused(false);
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [visible]);
  return (
    <div
      ref={root}
      className="feed-status"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node))
          setFocused(false);
      }}
    >
      <button
        type="button"
        aria-label="Open data sources"
        aria-expanded={visible}
        aria-controls={id}
        className={`feed-status-button inline-flex items-center gap-1.5 rounded border px-2 py-1 text-[10px] tracking-[0.12em] ${statusColor[status]}`}
        onClick={() => setPinned(!pinned)}
      >
        <span
          className="h-1.5 w-1.5 rounded-full bg-current"
          aria-hidden="true"
        />
        {label}
      </button>
      {visible && (
        <section
          id={id}
          className="feed-status-popover"
          aria-label="Connected feeds and counts"
        >
          <header>
            <strong>DATA LAYERS</strong>
            <span>Records received</span>
          </header>
          <FeedSummary />
          <p>{detail}</p>
          <button
            className="feed-diagnostics-link"
            onClick={() => {
              setPinned(false);
              setHovered(false);
              setFocused(false);
              useAuroraStore.getState().closeAllPanels();
              openPanel("data-layers");
            }}
          >
            Connection diagnostics ↗
          </button>
        </section>
      )}
    </div>
  );
}
