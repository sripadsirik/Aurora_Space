import { describe, expect, it } from "vitest";
import { parseXrayFlux, protonFluxToSScale } from "../../../utils/spaceWeatherScales";
import { mockKp24hHistory, mockSpaceWeather } from "../spaceWeather";

describe("mockSpaceWeather snapshot", () => {
  it("keeps both Kp readings within the 0-9 planetary range", () => {
    for (const kp of [mockSpaceWeather.kpIndex, mockSpaceWeather.auroraKp]) {
      expect(kp).toBeGreaterThanOrEqual(0);
      expect(kp).toBeLessThanOrEqual(9);
    }
  });

  it("reports a positive solar wind speed and density", () => {
    expect(mockSpaceWeather.solarWindSpeed).toBeGreaterThan(0);
    expect(mockSpaceWeather.solarWindDensity).toBeGreaterThan(0);
  });

  it("uses a known storm level", () => {
    const levels = new Set(["none", "minor", "moderate", "strong", "severe", "extreme"]);
    expect(levels.has(mockSpaceWeather.stormLevel)).toBe(true);
  });

  it("carries an X-ray flux class that parses to a positive flux", () => {
    const flux = parseXrayFlux(mockSpaceWeather.xrayFlux);
    expect(flux).not.toBeNull();
    expect(flux as number).toBeGreaterThan(0);
  });

  it("carries a non-negative proton flux that resolves to an S-level", () => {
    const flux = mockSpaceWeather.protonFlux ?? 0;
    expect(flux).toBeGreaterThanOrEqual(0);
    expect(protonFluxToSScale(flux)).toMatch(/^S[0-5]$/);
  });
});

describe("mockKp24hHistory", () => {
  it("holds 24 three-hourly readings", () => {
    expect(mockKp24hHistory).toHaveLength(24);
  });

  it("keeps every reading within the 0-9 planetary range", () => {
    for (const kp of mockKp24hHistory) {
      expect(kp).toBeGreaterThanOrEqual(0);
      expect(kp).toBeLessThanOrEqual(9);
    }
  });

  it("ends at the snapshot's current Kp reading", () => {
    expect(mockKp24hHistory[mockKp24hHistory.length - 1]).toBe(mockSpaceWeather.kpIndex);
  });
});
