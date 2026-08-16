import { describe, expect, it } from "vitest";
import { KP_MAX, kpFraction, kpToBarHeight, kpToPercent } from "../kpScale";

describe("KP_MAX", () => {
  it("is the top of the 0-9 Kp scale", () => {
    expect(KP_MAX).toBe(9);
  });
});

describe("kpFraction", () => {
  it("maps Kp 0 to 0 and Kp 9 to 1", () => {
    expect(kpFraction(0)).toBe(0);
    expect(kpFraction(9)).toBe(1);
  });

  it("maps a mid-scale reading to its proportion of the scale", () => {
    expect(kpFraction(4.5)).toBeCloseTo(0.5, 10);
  });

  it("clamps readings below Kp 0 to 0", () => {
    expect(kpFraction(-3)).toBe(0);
  });

  it("clamps readings above Kp 9 to 1", () => {
    expect(kpFraction(12)).toBe(1);
  });

  it("returns 0 for non-finite inputs", () => {
    expect(kpFraction(Number.NaN)).toBe(0);
    expect(kpFraction(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe("kpToPercent", () => {
  it("maps the scale endpoints to 0 and 100", () => {
    expect(kpToPercent(0)).toBe(0);
    expect(kpToPercent(9)).toBe(100);
  });

  it("maps a mid-scale reading to 50", () => {
    expect(kpToPercent(4.5)).toBeCloseTo(50, 10);
  });

  it("clamps out-of-range readings to the 0-100 bounds", () => {
    expect(kpToPercent(-1)).toBe(0);
    expect(kpToPercent(20)).toBe(100);
  });
});

describe("kpToBarHeight", () => {
  it("scales a reading to the given track height", () => {
    expect(kpToBarHeight(9, 58)).toBe(58);
    expect(kpToBarHeight(4.5, 58)).toBeCloseTo(29, 10);
    expect(kpToBarHeight(0, 58)).toBe(0);
  });

  it("clamps out-of-range readings within the track", () => {
    expect(kpToBarHeight(15, 40)).toBe(40);
    expect(kpToBarHeight(-2, 40)).toBe(0);
  });

  it("treats a negative track height as zero", () => {
    expect(kpToBarHeight(9, -58)).toBe(0);
  });
});
