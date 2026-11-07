import type { TrafficCamera } from "./data";

// Public embed URLs published by FOX 32 at the source below, checked 2026-11-05.
// Keep the official player so the provider handles expiring stream tokens.
const providerUrl = "https://www.fox32chicago.com/weather-cameras";
export const chicagoCameras: TrafficCamera[] = [
  {
    id: "camera:illinois:fox32-willis", name: "Willis Tower · live skyline video",
    lat: 41.8789, lon: -87.6359, network: "illinois", source: "FOX 32 Chicago / WMVision",
    observedAt: null, providerUrl,
    video: { kind: "embed", url: "https://api.wetmet.net/widgets/stream/frame.php?uid=bb1f0d7f31da085370753153f57204a5" },
    coverageNote: "Skyline view from atop Willis Tower on South Wacker Drive; not a street-level intersection camera. The provider controls stream availability.",
  },
  {
    id: "camera:illinois:fox32-river", name: "Chicago River / Wacker area · live scenic video",
    lat: 41.887, lon: -87.633, network: "illinois", source: "FOX 32 Chicago / WMVision",
    observedAt: null, providerUrl,
    video: { kind: "embed", url: "https://api.wetmet.net/widgets/stream/frame.php?uid=21ea1ed73c15cdeef86c7c7e8dfad8e1" },
    coverageNote: "Chicago River scenic view. Map marker is the approximate viewing area, not a verified camera mounting location or guaranteed view of a specific Wacker intersection.",
  },
];
