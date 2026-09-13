import { describe, expect, it } from "vitest";
import type { SpaceWeather } from "../../types/space";
import {
  ELECTRIC_FIELD_COEFFICIENT,
  electricFieldLevel,
  electricFieldProfile,
  geoeffectiveElectricField,
  interplanetaryElectricField
} from "../interplanetaryElectricField";

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

describe("electricFieldLevel", () => {
  it("labels each band by its representative field", () => {
    expect(electricFieldLevel(0.2)).toBe("quiet");
    expect(electricFieldLevel(1.5)).toBe("moderate");
    expect(electricFieldLevel(6)).toBe("strong");
    expect(electricFieldLevel(20)).toBe("extreme");
  });

  it("is inclusive at the lower edge of each band", () => {
    expect(electricFieldLevel(0.5)).toBe("moderate");
    expect(electricFieldLevel(3)).toBe("strong");
    expect(electricFieldLevel(10)).toBe("extreme");
  });

  it("treats a rectified (zero) field as quiet", () => {
    expect(electricFieldLevel(0)).toBe("quiet");
  });

  it("falls back to quiet for negative or non-finite input", () => {
    expect(electricFieldLevel(-4)).toBe("quiet");
    expect(electricFieldLevel(Number.NaN)).toBe("quiet");
  });
});

describe("electricFieldProfile", () => {
  it("derives every figure from the snapshot's speed and Bz", () => {
    const weather = makeWeather({ solarWindSpeed: 500, bzComponent: -6 });
    const profile = electricFieldProfile(weather);
    const field = interplanetaryElectricField(500, -6);
    expect(profile.fieldMvM).toBeCloseTo(field, 9);
    expect(profile.geoeffectiveMvM).toBeCloseTo(field, 9);
    expect(profile.level).toBe(electricFieldLevel(field));
    expect(profile.southward).toBe(true);
  });

  it("reports a quiet, non-geoeffective profile for a northward IMF", () => {
    const profile = electricFieldProfile(makeWeather({ solarWindSpeed: 600, bzComponent: 8 }));
    expect(profile.geoeffectiveMvM).toBe(0);
    expect(profile.level).toBe("quiet");
    expect(profile.southward).toBe(false);
  });

  it("strengthens the coupling field as a fast, strongly southward stream arrives", () => {
    const quiet = electricFieldProfile(makeWeather());
    const storm = electricFieldProfile(makeWeather({ solarWindSpeed: 800, bzComponent: -20 }));
    expect(storm.geoeffectiveMvM).toBeGreaterThan(quiet.geoeffectiveMvM);
    expect(storm.level).toBe("extreme");
  });
});
