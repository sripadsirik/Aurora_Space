import { describe, expect, it } from "vitest";
import type { SpaceWeather } from "../../types/space";
import {
  couplingLevel,
  couplingLevelLabel,
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

describe("couplingLevel", () => {
  it("reads a zero field as a closed magnetosphere", () => {
    expect(couplingLevel(0)).toBe("closed");
  });

  it("classifies a low field as weak background coupling", () => {
    expect(couplingLevel(1)).toBe("weak");
  });

  it("classifies a mid-range field as moderate", () => {
    expect(couplingLevel(3)).toBe("moderate");
  });

  it("classifies a high field as strong storm-driving coupling", () => {
    expect(couplingLevel(8)).toBe("strong");
  });

  it("places each band boundary in the higher band", () => {
    expect(couplingLevel(2)).toBe("moderate");
    expect(couplingLevel(5)).toBe("strong");
  });

  it("falls back to closed for negative or non-finite inputs", () => {
    expect(couplingLevel(-3)).toBe("closed");
    expect(couplingLevel(Number.NaN)).toBe("closed");
  });
});

describe("couplingLevelLabel", () => {
  it("maps each band to its uppercase display label", () => {
    expect(couplingLevelLabel("closed")).toBe("CLOSED");
    expect(couplingLevelLabel("weak")).toBe("WEAK");
    expect(couplingLevelLabel("moderate")).toBe("MODERATE");
    expect(couplingLevelLabel("strong")).toBe("STRONG");
  });

  it("labels the band a computed field falls in", () => {
    expect(couplingLevelLabel(couplingLevel(geoeffectiveElectricField(900, -20)))).toBe("STRONG");
    expect(couplingLevelLabel(couplingLevel(geoeffectiveElectricField(400, 5)))).toBe("CLOSED");
  });
});

describe("isStrongGeomagneticCoupling", () => {
  it("is false for a field below the threshold", () => {
    expect(isStrongGeomagneticCoupling(4)).toBe(false);
  });

  it("is true at exactly the threshold", () => {
    expect(isStrongGeomagneticCoupling(STRONG_COUPLING_FIELD_MVM)).toBe(true);
  });

  it("is true well above the threshold", () => {
    expect(isStrongGeomagneticCoupling(12)).toBe(true);
  });

  it("is false just below the threshold", () => {
    expect(isStrongGeomagneticCoupling(STRONG_COUPLING_FIELD_MVM - 0.01)).toBe(false);
  });

  it("is false for non-finite inputs, including infinity", () => {
    expect(isStrongGeomagneticCoupling(Number.NaN)).toBe(false);
    expect(isStrongGeomagneticCoupling(Number.POSITIVE_INFINITY)).toBe(false);
  });
});

describe("solarWindCouplingProfile", () => {
  it("derives every figure from the same computed electric field", () => {
    const weather = makeWeather({ solarWindSpeed: 700, bzComponent: -12 });
    const profile = solarWindCouplingProfile(weather);
    const field = geoeffectiveElectricField(700, -12);
    expect(profile.electricFieldMvM).toBeCloseTo(field, 9);
    expect(profile.level).toBe(couplingLevel(field));
    expect(profile.strong).toBe(isStrongGeomagneticCoupling(field));
  });

  it("reports a closed, uncoupled magnetosphere for a northward field", () => {
    const profile = solarWindCouplingProfile(makeWeather({ bzComponent: 6 }));
    expect(profile.electricFieldMvM).toBe(0);
    expect(profile.level).toBe("closed");
    expect(profile.strong).toBe(false);
  });

  it("flags strong coupling as a fast, strongly southward stream arrives", () => {
    const quiet = solarWindCouplingProfile(makeWeather());
    const shock = solarWindCouplingProfile(
      makeWeather({ solarWindSpeed: 900, bzComponent: -20 })
    );
    expect(shock.electricFieldMvM).toBeGreaterThan(quiet.electricFieldMvM);
    expect(shock.level).toBe("strong");
    expect(shock.strong).toBe(true);
  });
});
