import { describe, expect, it } from "vitest";
import type { SpaceWeather } from "../../types/space";
import {
  couplingLevel,
  geoeffectiveElectricField,
  isStrongGeomagneticCoupling,
  solarWindCouplingProfile,
  STRONG_COUPLING_FIELD_MVM
} from "../solarWindCoupling";

const makeWeather = (overrides: Partial<SpaceWeather> = {}): SpaceWeather => ({
  kpIndex: 3,
  solarWindSpeed: 400,
  solarWindDensity: 5,
  bzComponent: -2,
  xrayFlux: "B1.0",
  stormLevel: "none",
  auroraKp: 3,
  lastUpdated: new Date("2026-01-01T00:00:00Z"),
  ...overrides
});

describe("geoeffectiveElectricField", () => {
  it("rectifies a southward field to E = V · Bs in mV/m", () => {
    // 500 km/s and Bz -10 nT -> 500 * 10 * 1e-3 = 5 mV/m.
    expect(geoeffectiveElectricField(500, -10)).toBeCloseTo(5, 9);
  });

  it("is zero for a northward field, which does not couple", () => {
    expect(geoeffectiveElectricField(500, 10)).toBe(0);
  });

  it("treats a zero Bz as not geoeffective", () => {
    expect(geoeffectiveElectricField(500, 0)).toBe(0);
  });

  it("grows with both the wind speed and the southward field magnitude", () => {
    const base = geoeffectiveElectricField(400, -5);
    expect(geoeffectiveElectricField(800, -5)).toBeCloseTo(base * 2, 9);
    expect(geoeffectiveElectricField(400, -10)).toBeCloseTo(base * 2, 9);
  });

  it("returns zero for non-finite inputs", () => {
    expect(geoeffectiveElectricField(Number.NaN, -10)).toBe(0);
    expect(geoeffectiveElectricField(500, Number.NaN)).toBe(0);
    expect(geoeffectiveElectricField(Number.POSITIVE_INFINITY, -10)).toBe(0);
  });

  it("clamps a negative wind speed to zero", () => {
    expect(geoeffectiveElectricField(-500, -10)).toBe(0);
  });
});
