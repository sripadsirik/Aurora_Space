import { describe, expect, it } from "vitest";
import {
  STORM_INTENSITY_KP_FLOOR,
  STORM_INTENSITY_KP_SPAN,
  stormIntensity
} from "../stormOverlayStyle";

describe("stormIntensity", () => {
  it("is zero at the ramp floor", () => {
    expect(stormIntensity(STORM_INTENSITY_KP_FLOOR)).toBe(0);
  });

  it("reaches one at the top of the ramp", () => {
    expect(stormIntensity(STORM_INTENSITY_KP_FLOOR + STORM_INTENSITY_KP_SPAN)).toBe(1);
  });

  it("interpolates linearly across the ramp", () => {
    expect(stormIntensity(6.5)).toBeCloseTo(0.5, 10);
  });

  it("clamps a sub-floor Kp to zero instead of going negative", () => {
    expect(stormIntensity(2)).toBe(0);
  });

  it("clamps a Kp above the ramp top to one", () => {
    expect(stormIntensity(12)).toBe(1);
  });
});
