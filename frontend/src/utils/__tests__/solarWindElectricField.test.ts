import { describe, expect, it } from "vitest";
import type { SpaceWeather } from "../../types/space";
import {
  ELECTRIC_FIELD_COEFFICIENT,
  electricFieldLevel,
  geoeffectiveElectricField,
  solarWindElectricField,
  solarWindElectricFieldProfile
} from "../solarWindElectricField";

describe("solarWindElectricField", () => {
  it("computes E = k * v * B in mV/m", () => {
    // 400 km/s and 5 nT -> 400 * 5 * 1e-3 = 2 mV/m
    expect(solarWindElectricField(400, 5)).toBeCloseTo(2, 10);
    expect(ELECTRIC_FIELD_COEFFICIENT).toBe(1e-3);
  });

  it("uses the magnitude of the field, ignoring its sign", () => {
    expect(solarWindElectricField(500, -8)).toBeCloseTo(solarWindElectricField(500, 8), 10);
  });

  it("takes the magnitude of the speed", () => {
    expect(solarWindElectricField(-400, 5)).toBeCloseTo(2, 10);
  });

  it("returns zero for non-finite inputs", () => {
    expect(solarWindElectricField(NaN, 5)).toBe(0);
    expect(solarWindElectricField(400, Infinity)).toBe(0);
  });

  it("returns zero when either input is zero", () => {
    expect(solarWindElectricField(0, 5)).toBe(0);
    expect(solarWindElectricField(400, 0)).toBe(0);
  });
});

describe("geoeffectiveElectricField", () => {
  it("returns the full field magnitude for a southward IMF", () => {
    // 400 km/s, Bz = -5 nT -> 2 mV/m
    expect(geoeffectiveElectricField(400, -5)).toBeCloseTo(2, 10);
  });

  it("returns zero for a northward or zero IMF", () => {
    expect(geoeffectiveElectricField(400, 5)).toBe(0);
    expect(geoeffectiveElectricField(400, 0)).toBe(0);
  });

  it("returns zero for a non-finite Bz", () => {
    expect(geoeffectiveElectricField(400, NaN)).toBe(0);
  });

  it("matches the raw field magnitude when southward", () => {
    expect(geoeffectiveElectricField(600, -9)).toBeCloseTo(solarWindElectricField(600, 9), 10);
  });
});

describe("electricFieldLevel", () => {
  it("classifies each band by its representative value", () => {
    expect(electricFieldLevel(0.2)).toBe("quiet");
    expect(electricFieldLevel(1.5)).toBe("moderate");
    expect(electricFieldLevel(5)).toBe("strong");
    expect(electricFieldLevel(12)).toBe("extreme");
  });

  it("places band boundaries in the higher band", () => {
    expect(electricFieldLevel(0.8)).toBe("moderate");
    expect(electricFieldLevel(3)).toBe("strong");
    expect(electricFieldLevel(8)).toBe("extreme");
  });

  it("falls back to quiet for negative or non-finite inputs", () => {
    expect(electricFieldLevel(-1)).toBe("quiet");
    expect(electricFieldLevel(NaN)).toBe("quiet");
  });
});

describe("solarWindElectricFieldProfile", () => {
  const makeWeather = (overrides: Partial<SpaceWeather> = {}): SpaceWeather => ({
    kpIndex: 3,
    solarWindSpeed: 420,
    solarWindDensity: 5.1,
    bzComponent: -2,
    xrayFlux: "C2.4",
    stormLevel: "minor",
    auroraKp: 3,
    lastUpdated: new Date("2026-09-05T12:00:00Z"),
    ...overrides
  });

  it("derives every figure from the snapshot's speed and Bz", () => {
    const profile = solarWindElectricFieldProfile(
      makeWeather({ solarWindSpeed: 500, bzComponent: -6 })
    );
    expect(profile.fieldMvM).toBeCloseTo(3, 10);
    expect(profile.geoeffectiveMvM).toBeCloseTo(3, 10);
    expect(profile.southward).toBe(true);
    expect(profile.level).toBe("strong");
  });

  it("zeroes the geoeffective field for a northward IMF but keeps the raw field", () => {
    const profile = solarWindElectricFieldProfile(
      makeWeather({ solarWindSpeed: 500, bzComponent: 6 })
    );
    expect(profile.fieldMvM).toBeCloseTo(3, 10);
    expect(profile.geoeffectiveMvM).toBe(0);
    expect(profile.southward).toBe(false);
    expect(profile.level).toBe("quiet");
  });
});
