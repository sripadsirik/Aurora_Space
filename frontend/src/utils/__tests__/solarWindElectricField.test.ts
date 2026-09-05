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
