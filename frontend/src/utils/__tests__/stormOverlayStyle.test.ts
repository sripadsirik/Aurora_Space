import { describe, expect, it } from "vitest";
import {
  STORM_INTENSITY_KP_FLOOR,
  STORM_INTENSITY_KP_SPAN,
  stormIntensity,
  stormVignetteShadow
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

describe("stormVignetteShadow", () => {
  it("uses the calm blur, spread, and warmth at zero intensity", () => {
    expect(stormVignetteShadow(0)).toBe("inset 0 0 80px 20px rgba(255,70,0,0.15)");
  });

  it("deepens the blur, spread, and redness at full intensity", () => {
    expect(stormVignetteShadow(1)).toBe("inset 0 0 200px 60px rgba(255,30,0,0.35)");
  });

  it("rounds the green channel to a whole value", () => {
    expect(stormVignetteShadow(0.5)).toBe("inset 0 0 140px 40px rgba(255,50,0,0.25)");
  });
});
