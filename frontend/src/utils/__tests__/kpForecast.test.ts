import { describe, expect, it } from "vitest";

import {
  KP_FORECAST_POINTS,
  KP_FORECAST_STEP_HOURS,
  KP_MAX,
  KP_MIN,
  buildKpForecast
} from "../kpForecast";

describe("buildKpForecast", () => {
  it("returns the configured number of points", () => {
    expect(buildKpForecast(3)).toHaveLength(KP_FORECAST_POINTS);
  });

  it("spaces samples by the configured step in hours", () => {
    const forecast = buildKpForecast(3);
    forecast.forEach((point, index) => {
      expect(point.hoursAhead).toBe(index * KP_FORECAST_STEP_HOURS);
    });
  });

  it("is deterministic for a given input", () => {
    expect(buildKpForecast(4)).toEqual(buildKpForecast(4));
  });

  it("clamps every sample into the valid Kp range", () => {
    for (const kp of [-5, 0, 4.5, 9, 20]) {
      for (const point of buildKpForecast(kp)) {
        expect(point.kp).toBeGreaterThanOrEqual(KP_MIN);
        expect(point.kp).toBeLessThanOrEqual(KP_MAX);
      }
    }
  });

  it("rounds samples to one decimal place", () => {
    for (const point of buildKpForecast(4.3)) {
      expect(Number(point.kp.toFixed(1))).toBe(point.kp);
    }
  });

  it("clamps upward wobble at the ceiling for a maxed-out storm", () => {
    const forecast = buildKpForecast(9);
    for (const point of forecast) {
      expect(point.kp).toBeLessThanOrEqual(KP_MAX);
    }
    // The first sample wobbles above 9 and must be pinned to the ceiling.
    expect(forecast[0].kp).toBe(KP_MAX);
  });

  it("never dips below the floor for a quiet field", () => {
    for (const point of buildKpForecast(0)) {
      expect(point.kp).toBeGreaterThanOrEqual(KP_MIN);
    }
  });
});
