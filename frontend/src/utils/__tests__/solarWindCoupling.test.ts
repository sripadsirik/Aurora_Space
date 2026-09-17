import { describe, expect, it } from "vitest";

import { southwardBz } from "../solarWindCoupling";

describe("southwardBz", () => {
  it("returns the magnitude of a southward (negative) Bz", () => {
    expect(southwardBz(-5)).toBe(5);
    expect(southwardBz(-12.4)).toBeCloseTo(12.4);
  });

  it("rectifies a northward or zero field to zero", () => {
    expect(southwardBz(8)).toBe(0);
    expect(southwardBz(0)).toBe(0);
  });

  it("treats non-finite readings as not southward", () => {
    expect(southwardBz(Number.NaN)).toBe(0);
    expect(southwardBz(Number.POSITIVE_INFINITY)).toBe(0);
    expect(southwardBz(Number.NEGATIVE_INFINITY)).toBe(0);
  });
});
