import { describe, expect, it } from "vitest";
import { moonIlluminationFraction } from "../auroraMoonlight";

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
