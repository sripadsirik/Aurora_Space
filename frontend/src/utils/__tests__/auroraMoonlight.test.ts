import { describe, expect, it } from "vitest";
import {
  MOONLIGHT_INTERFERENCE_LABELS,
  MOONLIGHT_INTERFERENCE_THRESHOLDS,
  classifyMoonlightInterference,
  moonIlluminationFraction,
  moonlightSeverity
} from "../auroraMoonlight";

describe("moonIlluminationFraction", () => {
  it("passes through values already within [0, 1]", () => {
    expect(moonIlluminationFraction(0)).toBe(0);
    expect(moonIlluminationFraction(0.5)).toBe(0.5);
    expect(moonIlluminationFraction(1)).toBe(1);
  });

  it("clamps values above a full Moon to 1", () => {
    expect(moonIlluminationFraction(1.2)).toBe(1);
    expect(moonIlluminationFraction(42)).toBe(1);
  });

  it("clamps values below a new Moon to 0", () => {
    expect(moonIlluminationFraction(-0.3)).toBe(0);
    expect(moonIlluminationFraction(-10)).toBe(0);
  });

  it("treats non-finite readings as a new Moon", () => {
    expect(moonIlluminationFraction(Number.NaN)).toBe(0);
    expect(moonIlluminationFraction(Number.POSITIVE_INFINITY)).toBe(0);
    expect(moonIlluminationFraction(Number.NEGATIVE_INFINITY)).toBe(0);
  });
});

describe("classifyMoonlightInterference", () => {
  it("keeps a new Moon and thin crescent in the dark tier", () => {
    expect(classifyMoonlightInterference(0)).toBe("dark");
    expect(classifyMoonlightInterference(0.05)).toBe("dark");
  });

  it("classifies a broad crescent through first quarter as dim", () => {
    expect(classifyMoonlightInterference(0.1)).toBe("dim");
    expect(classifyMoonlightInterference(0.3)).toBe("dim");
    expect(classifyMoonlightInterference(0.49)).toBe("dim");
  });

  it("classifies a gibbous Moon as bright", () => {
    expect(classifyMoonlightInterference(0.5)).toBe("bright");
    expect(classifyMoonlightInterference(0.8)).toBe("bright");
  });

  it("classifies a near-full Moon as washed-out", () => {
    expect(classifyMoonlightInterference(0.85)).toBe("washed-out");
    expect(classifyMoonlightInterference(1)).toBe("washed-out");
  });

  it("is monotonic across each threshold boundary", () => {
    expect(classifyMoonlightInterference(MOONLIGHT_INTERFERENCE_THRESHOLDS.dim)).toBe("dim");
    expect(classifyMoonlightInterference(MOONLIGHT_INTERFERENCE_THRESHOLDS.bright)).toBe("bright");
    expect(classifyMoonlightInterference(MOONLIGHT_INTERFERENCE_THRESHOLDS.washedOut)).toBe(
      "washed-out"
    );
  });

  it("normalises out-of-range readings before classifying", () => {
    expect(classifyMoonlightInterference(-1)).toBe("dark");
    expect(classifyMoonlightInterference(2)).toBe("washed-out");
    expect(classifyMoonlightInterference(Number.NaN)).toBe("dark");
  });
});

describe("MOONLIGHT_INTERFERENCE_LABELS", () => {
  it("has a non-empty label for every tier", () => {
    for (const tier of ["dark", "dim", "bright", "washed-out"] as const) {
      expect(MOONLIGHT_INTERFERENCE_LABELS[tier].length).toBeGreaterThan(0);
    }
  });

  it("gives each tier a distinct label", () => {
    const labels = Object.values(MOONLIGHT_INTERFERENCE_LABELS);
    expect(new Set(labels).size).toBe(labels.length);
  });
});

describe("moonlightSeverity", () => {
  it("is zero at new Moon and one at full Moon", () => {
    expect(moonlightSeverity(0)).toBe(0);
    expect(moonlightSeverity(1)).toBe(1);
  });

  it("weights a half-lit Moon well below half severity", () => {
    expect(moonlightSeverity(0.5)).toBeCloseTo(0.25);
  });

  it("increases monotonically with illumination", () => {
    let previous = -1;
    for (let fraction = 0; fraction <= 1; fraction += 0.1) {
      const severity = moonlightSeverity(fraction);
      expect(severity).toBeGreaterThanOrEqual(previous);
      previous = severity;
    }
  });

  it("stays within [0, 1] for out-of-range readings", () => {
    expect(moonlightSeverity(-5)).toBe(0);
    expect(moonlightSeverity(5)).toBe(1);
    expect(moonlightSeverity(Number.NaN)).toBe(0);
  });
});
