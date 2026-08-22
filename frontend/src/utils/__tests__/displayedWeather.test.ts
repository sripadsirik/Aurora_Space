import { describe, expect, it } from "vitest";
import type { SpaceWeather } from "../../types/space";
import { resolveDisplayedWeather } from "../displayedWeather";

const feed: SpaceWeather = {
  kpIndex: 3,
  solarWindSpeed: 420,
  solarWindDensity: 5.1,
  bzComponent: -2,
  xrayFlux: "C2.4",
  stormLevel: "minor",
  auroraKp: 3,
  lastUpdated: new Date("2026-08-22T12:00:00Z")
};

describe("resolveDisplayedWeather", () => {
  it("falls back to the live feed when no timeline event is active", () => {
    expect(resolveDisplayedWeather(feed)).toEqual({
      kpIndex: 3,
      solarWindSpeed: 420,
      bzComponent: -2,
      stormLevel: "minor"
    });
  });

  it("treats a null timeline event the same as no event", () => {
    expect(resolveDisplayedWeather(feed, null)).toEqual({
      kpIndex: 3,
      solarWindSpeed: 420,
      bzComponent: -2,
      stormLevel: "minor"
    });
  });

  it("overrides each field the timeline event supplies", () => {
    const resolved = resolveDisplayedWeather(feed, {
      kpIndex: 8,
      solarWindSpeed: 900,
      bzComponent: -18,
      stormLevel: "extreme"
    });
    expect(resolved).toEqual({
      kpIndex: 8,
      solarWindSpeed: 900,
      bzComponent: -18,
      stormLevel: "extreme"
    });
  });

  it("mixes event fields with feed fallbacks when the event is partial", () => {
    const resolved = resolveDisplayedWeather(feed, { kpIndex: 6 });
    expect(resolved).toEqual({
      kpIndex: 6,
      solarWindSpeed: 420,
      bzComponent: -2,
      stormLevel: "minor"
    });
  });

  it("keeps a zero override instead of falling through to the feed", () => {
    const resolved = resolveDisplayedWeather(feed, { bzComponent: 0 });
    expect(resolved.bzComponent).toBe(0);
  });
});
