import { describe, expect, it } from "vitest";

import type { HistoricalEvent, SpaceWeather } from "../../types/space";
import { resolveEffectiveWeather } from "../effectiveWeather";

const baseWeather: SpaceWeather = {
  kpIndex: 3.2,
  solarWindSpeed: 420,
  solarWindDensity: 5.1,
  bzComponent: -2.4,
  xrayFlux: "B1.2",
  stormLevel: "minor",
  auroraKp: 3,
  lastUpdated: new Date("2026-08-23T00:00:00Z")
};

describe("resolveEffectiveWeather", () => {
  it("returns the live feed values when there is no timeline event", () => {
    expect(resolveEffectiveWeather(null, baseWeather)).toEqual({
      kpIndex: 3.2,
      solarWindSpeed: 420,
      bzComponent: -2.4,
      stormLevel: "minor"
    });
  });

  it("overrides each field the timeline event provides", () => {
    const event: HistoricalEvent = {
      id: "carrington",
      name: "Carrington Event",
      date: new Date("1859-09-01T00:00:00Z"),
      description: "Extreme geomagnetic storm",
      type: "solar_storm",
      kpIndex: 9,
      solarWindSpeed: 850,
      bzComponent: -40,
      stormLevel: "extreme"
    };

    expect(resolveEffectiveWeather(event, baseWeather)).toEqual({
      kpIndex: 9,
      solarWindSpeed: 850,
      bzComponent: -40,
      stormLevel: "extreme"
    });
  });

  it("falls back to the live feed for fields the event omits", () => {
    const event: HistoricalEvent = {
      id: "partial",
      name: "Partial Event",
      date: new Date("2003-10-29T00:00:00Z"),
      description: "Only kp recorded",
      type: "solar_storm",
      kpIndex: 8
    };

    expect(resolveEffectiveWeather(event, baseWeather)).toEqual({
      kpIndex: 8,
      solarWindSpeed: 420,
      bzComponent: -2.4,
      stormLevel: "minor"
    });
  });

  it("preserves a zero bz override rather than treating it as missing", () => {
    const event: HistoricalEvent = {
      id: "zero-bz",
      name: "Zero Bz",
      date: new Date("2026-08-23T00:00:00Z"),
      description: "Northward IMF",
      type: "solar_storm",
      bzComponent: 0
    };

    expect(resolveEffectiveWeather(event, baseWeather).bzComponent).toBe(0);
  });
});
