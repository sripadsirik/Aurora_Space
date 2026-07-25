import { describe, expect, it } from "vitest";
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
});
