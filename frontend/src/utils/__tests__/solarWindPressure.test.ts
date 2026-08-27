import { describe, expect, it } from "vitest";
import type { SpaceWeather } from "../../types/space";
import {
  DYNAMIC_PRESSURE_COEFFICIENT,
  NOMINAL_DYNAMIC_PRESSURE_NPA,
  GEO_RADIUS_RE,
  NOMINAL_MAGNETOPAUSE_STANDOFF_RE,
  dynamicPressureLevel,
  isMagnetopauseInsideGeo,
  magnetopauseStandoffRe,
  solarWindDynamicPressure,
  solarWindPressureProfile
} from "../solarWindPressure";

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

describe("solarWindDynamicPressure", () => {
  it("follows Pdyn = k * n * v^2 for nominal solar wind", () => {
    const expected = DYNAMIC_PRESSURE_COEFFICIENT * 5 * 400 * 400;
    expect(solarWindDynamicPressure(5, 400)).toBeCloseTo(expected, 9);
  });

  it("lands in the typical 1-3 nPa band for quiet conditions", () => {
    const pressure = solarWindDynamicPressure(5, 400);
    expect(pressure).toBeGreaterThan(1);
    expect(pressure).toBeLessThan(3);
  });

  it("scales with the square of the bulk speed", () => {
    const slow = solarWindDynamicPressure(5, 400);
    const fast = solarWindDynamicPressure(5, 800);
    expect(fast).toBeCloseTo(slow * 4, 9);
  });

  it("scales linearly with proton density", () => {
    const sparse = solarWindDynamicPressure(4, 500);
    const dense = solarWindDynamicPressure(12, 500);
    expect(dense).toBeCloseTo(sparse * 3, 9);
  });

  it("is zero when the wind is at rest or has no protons", () => {
    expect(solarWindDynamicPressure(0, 500)).toBe(0);
    expect(solarWindDynamicPressure(5, 0)).toBe(0);
  });

  it("clamps negative inputs to zero rather than returning a negative pressure", () => {
    expect(solarWindDynamicPressure(-5, 400)).toBe(0);
    expect(solarWindDynamicPressure(5, -400)).toBe(0);
  });

  it("returns zero for non-finite inputs instead of NaN", () => {
    expect(solarWindDynamicPressure(Number.NaN, 400)).toBe(0);
    expect(solarWindDynamicPressure(5, Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe("magnetopauseStandoffRe", () => {
  it("returns the nominal standoff at the nominal pressure", () => {
    expect(magnetopauseStandoffRe(NOMINAL_DYNAMIC_PRESSURE_NPA)).toBeCloseTo(
      NOMINAL_MAGNETOPAUSE_STANDOFF_RE,
      9
    );
  });

  it("pushes the boundary inward as the pressure rises", () => {
    const quiet = magnetopauseStandoffRe(1);
    const gust = magnetopauseStandoffRe(20);
    expect(gust).toBeLessThan(quiet);
  });

  it("follows the inverse-sixth-power scaling law", () => {
    const base = magnetopauseStandoffRe(2);
    // A 64-fold pressure jump halves the standoff (64^(1/6) = 2).
    expect(magnetopauseStandoffRe(2 * 64)).toBeCloseTo(base / 2, 9);
  });

  it("keeps a nominal boundary well outside geostationary orbit", () => {
    expect(magnetopauseStandoffRe(NOMINAL_DYNAMIC_PRESSURE_NPA)).toBeGreaterThan(6.6);
  });

  it("treats an unopposed magnetosphere as an infinite standoff", () => {
    expect(magnetopauseStandoffRe(0)).toBe(Infinity);
    expect(magnetopauseStandoffRe(-1)).toBe(Infinity);
    expect(magnetopauseStandoffRe(Number.NaN)).toBe(Infinity);
  });
});

describe("isMagnetopauseInsideGeo", () => {
  it("is false for a nominal, uncompressed boundary", () => {
    const standoff = magnetopauseStandoffRe(NOMINAL_DYNAMIC_PRESSURE_NPA);
    expect(isMagnetopauseInsideGeo(standoff)).toBe(false);
  });

  it("is true once the boundary is squeezed to geostationary orbit", () => {
    expect(isMagnetopauseInsideGeo(GEO_RADIUS_RE)).toBe(true);
    expect(isMagnetopauseInsideGeo(GEO_RADIUS_RE - 1)).toBe(true);
  });

  it("flags GEO exposure only under extreme ram-pressure loading", () => {
    // A ~20 nPa gust drives the boundary to roughly 7.1 Re — still outside GEO.
    expect(isMagnetopauseInsideGeo(magnetopauseStandoffRe(20))).toBe(false);
    // A CME shock near 40 nPa pushes it inside 6.6 Re.
    expect(isMagnetopauseInsideGeo(magnetopauseStandoffRe(40))).toBe(true);
  });
});

describe("dynamicPressureLevel", () => {
  it("labels each band by its representative pressure", () => {
    expect(dynamicPressureLevel(0.5)).toBe("quiet");
    expect(dynamicPressureLevel(2)).toBe("nominal");
    expect(dynamicPressureLevel(6)).toBe("elevated");
    expect(dynamicPressureLevel(15)).toBe("extreme");
  });

  it("is inclusive at the lower edge of each band", () => {
    expect(dynamicPressureLevel(1)).toBe("nominal");
    expect(dynamicPressureLevel(3)).toBe("elevated");
    expect(dynamicPressureLevel(10)).toBe("extreme");
  });

  it("falls back to quiet for negative or non-finite input", () => {
    expect(dynamicPressureLevel(-4)).toBe("quiet");
    expect(dynamicPressureLevel(Number.NaN)).toBe("quiet");
  });
});

describe("solarWindPressureProfile", () => {
  it("derives every figure from the same computed dynamic pressure", () => {
    const weather = makeWeather({ solarWindDensity: 6, solarWindSpeed: 500 });
    const profile = solarWindPressureProfile(weather);
    const pressure = solarWindDynamicPressure(6, 500);
    expect(profile.dynamicPressureNPa).toBeCloseTo(pressure, 9);
    expect(profile.magnetopauseStandoffRe).toBeCloseTo(magnetopauseStandoffRe(pressure), 9);
    expect(profile.insideGeo).toBe(isMagnetopauseInsideGeo(profile.magnetopauseStandoffRe));
  });

  it("reports a nominal, uncompressed boundary for quiet solar wind", () => {
    const profile = solarWindPressureProfile(makeWeather());
    expect(profile.level).toBe("nominal");
    expect(profile.insideGeo).toBe(false);
    expect(profile.magnetopauseStandoffRe).toBeGreaterThan(GEO_RADIUS_RE);
  });

  it("compresses the boundary inward as a dense, fast stream arrives", () => {
    const quiet = solarWindPressureProfile(makeWeather());
    const shock = solarWindPressureProfile(
      makeWeather({ solarWindDensity: 30, solarWindSpeed: 900 })
    );
    expect(shock.dynamicPressureNPa).toBeGreaterThan(quiet.dynamicPressureNPa);
    expect(shock.magnetopauseStandoffRe).toBeLessThan(quiet.magnetopauseStandoffRe);
    expect(shock.level).toBe("extreme");
  });
});
