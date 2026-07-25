import { describe, expect, it } from "vitest";
import { parseXrayFlux } from "../../../utils/spaceWeatherScales";
import { mockSpaceWeather } from "../spaceWeather";

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
});
