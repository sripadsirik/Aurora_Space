import { describe, expect, it } from "vitest";

import {
  MERGING_FIELD_COEFFICIENT,
  mergingElectricFieldMvM,
  southwardBz
} from "../solarWindCoupling";

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

describe("mergingElectricFieldMvM", () => {
  it("computes VBs = k * v * Bs for a southward field", () => {
    // 400 km/s with a -5 nT field -> 1e-3 * 400 * 5 = 2 mV/m.
    expect(mergingElectricFieldMvM(400, -5)).toBeCloseTo(2);
    expect(mergingElectricFieldMvM(600, -10)).toBeCloseTo(6);
  });

  it("is zero for a northward or zero field regardless of speed", () => {
    expect(mergingElectricFieldMvM(800, 6)).toBe(0);
    expect(mergingElectricFieldMvM(800, 0)).toBe(0);
  });

  it("scales linearly with the merging-field coefficient", () => {
    expect(mergingElectricFieldMvM(500, -4)).toBeCloseTo(
      MERGING_FIELD_COEFFICIENT * 500 * 4
    );
  });

  it("treats non-finite or negative speeds as zero", () => {
    expect(mergingElectricFieldMvM(Number.NaN, -5)).toBe(0);
    expect(mergingElectricFieldMvM(Number.POSITIVE_INFINITY, -5)).toBe(0);
    expect(mergingElectricFieldMvM(-400, -5)).toBe(0);
  });
});
