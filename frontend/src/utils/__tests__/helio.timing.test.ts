import { describe, expect, it } from "vitest";
import {
  HELIO_CME_DURATION_SECONDS,
  HELIO_CME_MAX_RADIUS,
  HELIO_ORBIT_RADII,
  formatHelioArrivalLabel,
  getHelioCmeRadius,
  getHelioRemainingSeconds
} from "../helio";

describe("getHelioCmeRadius", () => {
  it("starts at the Sun", () => {
    expect(getHelioCmeRadius(0)).toBe(0);
  });

  it("reaches the Earth's orbital radius after the full CME duration", () => {
    expect(getHelioCmeRadius(HELIO_CME_DURATION_SECONDS)).toBeCloseTo(HELIO_ORBIT_RADII.earth, 3);
  });

  it("grows monotonically before wrapping", () => {
    expect(getHelioCmeRadius(HELIO_CME_DURATION_SECONDS / 2)).toBeGreaterThan(getHelioCmeRadius(0));
  });

  it("wraps around once it passes the maximum radius", () => {
    expect(getHelioCmeRadius(HELIO_CME_DURATION_SECONDS * 100)).toBeLessThan(HELIO_CME_MAX_RADIUS);
  });
});

describe("getHelioRemainingSeconds", () => {
  it("returns the full duration at the start", () => {
    expect(getHelioRemainingSeconds(0)).toBe(HELIO_CME_DURATION_SECONDS);
  });

  it("counts down as time elapses", () => {
    expect(getHelioRemainingSeconds(3600)).toBe(HELIO_CME_DURATION_SECONDS - 3600);
  });

  it("never goes negative", () => {
    expect(getHelioRemainingSeconds(HELIO_CME_DURATION_SECONDS + 10_000)).toBe(0);
  });
});

describe("formatHelioArrivalLabel", () => {
  it("formats the remaining time as zero-padded h/m/s", () => {
    // 72h duration minus 1h 2m 3s elapsed -> 70h 57m 57s remaining
    const elapsed = 1 * 3600 + 2 * 60 + 3;
    expect(formatHelioArrivalLabel(elapsed)).toBe("70h 57m 57s");
  });

  it("shows all zeros once the CME has arrived", () => {
    expect(formatHelioArrivalLabel(HELIO_CME_DURATION_SECONDS)).toBe("0h 00m 00s");
  });
});
