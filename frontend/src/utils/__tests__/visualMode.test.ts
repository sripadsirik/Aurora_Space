import { describe, expect, it } from "vitest";

import { STORM_KP_THRESHOLD, isStormModeActive } from "../visualMode";

describe("isStormModeActive", () => {
  it("is active whenever STORM mode is explicitly selected", () => {
    expect(isStormModeActive("STORM", 0)).toBe(true);
  });

  it("is active in any mode once Kp climbs past the threshold", () => {
    expect(isStormModeActive("OPS", STORM_KP_THRESHOLD + 0.1)).toBe(true);
    expect(isStormModeActive("INTEL", 8)).toBe(true);
  });

  it("is inactive in a non-storm mode at or below the threshold", () => {
    expect(isStormModeActive("OPS", STORM_KP_THRESHOLD)).toBe(false);
    expect(isStormModeActive("INTEL", 2)).toBe(false);
    expect(isStormModeActive("HELIO", 0)).toBe(false);
  });

  it("treats the threshold as exclusive", () => {
    expect(isStormModeActive("OPS", STORM_KP_THRESHOLD)).toBe(false);
    expect(isStormModeActive("OPS", STORM_KP_THRESHOLD + 0.01)).toBe(true);
  });
});
