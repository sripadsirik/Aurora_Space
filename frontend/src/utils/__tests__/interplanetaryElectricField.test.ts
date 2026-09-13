import { describe, expect, it } from "vitest";
import {
  ELECTRIC_FIELD_COEFFICIENT,
  geoeffectiveElectricField,
  interplanetaryElectricField
} from "../interplanetaryElectricField";

describe("interplanetaryElectricField", () => {
  it("follows Ey = -v * Bz for a southward field", () => {
    const expected = -ELECTRIC_FIELD_COEFFICIENT * 400 * -5;
    expect(interplanetaryElectricField(400, -5)).toBeCloseTo(expected, 9);
  });

  it("is positive (geoeffective) when the IMF points southward", () => {
    expect(interplanetaryElectricField(500, -8)).toBeGreaterThan(0);
  });

  it("is negative when the IMF points northward", () => {
    expect(interplanetaryElectricField(500, 8)).toBeLessThan(0);
  });

  it("lands near a fraction of a mV/m for quiet solar wind", () => {
    // 400 km/s and -2 nT give 0.8 mV/m.
    expect(interplanetaryElectricField(400, -2)).toBeCloseTo(0.8, 9);
  });

  it("scales linearly with the bulk speed", () => {
    const slow = interplanetaryElectricField(400, -5);
    const fast = interplanetaryElectricField(800, -5);
    expect(fast).toBeCloseTo(slow * 2, 9);
  });

  it("is zero when the field has no north-south component", () => {
    expect(interplanetaryElectricField(600, 0)).toBeCloseTo(0, 9);
  });

  it("clamps a back-blowing (negative) speed to zero", () => {
    expect(interplanetaryElectricField(-400, -5)).toBe(0);
  });

  it("returns zero for non-finite inputs instead of NaN", () => {
    expect(interplanetaryElectricField(Number.NaN, -5)).toBe(0);
    expect(interplanetaryElectricField(400, Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe("geoeffectiveElectricField", () => {
  it("matches the signed field while the IMF is southward", () => {
    expect(geoeffectiveElectricField(500, -6)).toBeCloseTo(
      interplanetaryElectricField(500, -6),
      9
    );
  });

  it("rectifies a northward field to zero forcing", () => {
    expect(geoeffectiveElectricField(500, 6)).toBe(0);
  });

  it("is zero for a purely northward or null field", () => {
    expect(geoeffectiveElectricField(600, 4)).toBe(0);
    expect(geoeffectiveElectricField(600, 0)).toBe(0);
  });

  it("never returns a negative value", () => {
    expect(geoeffectiveElectricField(800, 10)).toBeGreaterThanOrEqual(0);
    expect(geoeffectiveElectricField(800, -10)).toBeGreaterThanOrEqual(0);
  });
});
