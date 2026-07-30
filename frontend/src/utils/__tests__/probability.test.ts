import { describe, expect, it } from "vitest";
import { CONJUNCTION_RISK_THRESHOLDS } from "../conjunctionRisk";
import { normalizeProbability } from "../probability";

describe("normalizeProbability", () => {
  it("returns 0 for non-positive probabilities", () => {
    expect(normalizeProbability(0)).toBe(0);
    expect(normalizeProbability(-0.5)).toBe(0);
  });

  it("maps the 1e-6 floor to 0", () => {
    expect(normalizeProbability(1e-6)).toBeCloseTo(0, 10);
  });

  it("maps the 1e-3 ceiling to 1", () => {
    expect(normalizeProbability(1e-3)).toBeCloseTo(1, 10);
  });

  it("interpolates the log-space midpoint to 0.5", () => {
    expect(normalizeProbability(10 ** -4.5)).toBeCloseTo(0.5, 10);
  });

  it("clamps probabilities below the floor to 0", () => {
    expect(normalizeProbability(1e-9)).toBe(0);
  });

  it("clamps probabilities above the ceiling to 1", () => {
    expect(normalizeProbability(0.5)).toBe(1);
  });

  it("anchors the gauge floor and ceiling to the shared risk thresholds", () => {
    expect(normalizeProbability(CONJUNCTION_RISK_THRESHOLDS.watch)).toBeCloseTo(0, 10);
    expect(normalizeProbability(CONJUNCTION_RISK_THRESHOLDS.critical)).toBeCloseTo(1, 10);
  });
});
