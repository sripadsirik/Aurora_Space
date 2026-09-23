import { describe, expect, it } from "vitest";

import {
  STORM_KP_THRESHOLD,
  isStormLevelKp,
  isStormModeActive,
  shouldAutoActivateStorm
} from "../visualMode";

describe("isStormLevelKp", () => {
  it("is true once Kp climbs strictly past the threshold", () => {
    expect(isStormLevelKp(STORM_KP_THRESHOLD + 0.01)).toBe(true);
    expect(isStormLevelKp(9)).toBe(true);
  });

  it("is false at or below the threshold", () => {
    expect(isStormLevelKp(STORM_KP_THRESHOLD)).toBe(false);
    expect(isStormLevelKp(0)).toBe(false);
  });

  it("treats the threshold as exclusive", () => {
    expect(isStormLevelKp(STORM_KP_THRESHOLD)).toBe(false);
    expect(isStormLevelKp(STORM_KP_THRESHOLD + 0.001)).toBe(true);
  });
});

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

describe("shouldAutoActivateStorm", () => {
  it("triggers from a non-storm mode once Kp is storm-level", () => {
    expect(shouldAutoActivateStorm("OPS", STORM_KP_THRESHOLD + 0.1)).toBe(true);
    expect(shouldAutoActivateStorm("INTEL", 8)).toBe(true);
  });

  it("does not trigger when already in STORM mode", () => {
    expect(shouldAutoActivateStorm("STORM", 9)).toBe(false);
  });

  it("does not trigger below or at the threshold", () => {
    expect(shouldAutoActivateStorm("OPS", STORM_KP_THRESHOLD)).toBe(false);
    expect(shouldAutoActivateStorm("HELIO", 1)).toBe(false);
  });
});
