import { describe, expect, it } from "vitest";
import type { OrbitType, RiskLevel, Satellite } from "../../types/space";
import {
  averageAltitudeKm,
  averageVelocityKms,
  countByOrbitType,
  countByRiskLevel,
  totalConjunctions
} from "../catalogStats";

const makeSatellite = (overrides: Partial<Satellite> = {}): Satellite => ({
  noradId: 1,
  name: "TEST",
  lat: 0,
  lon: 0,
  altitudeKm: 550,
  velocityKms: 7.6,
  orbitType: "LEO",
  riskLevel: "nominal",
  owner: "TEST",
  conjunctionCount: 0,
  ...overrides
});

const makeCatalog = (orbitTypes: OrbitType[]): Satellite[] =>
  orbitTypes.map((orbitType, index) => makeSatellite({ noradId: index + 1, orbitType }));

describe("countByOrbitType", () => {
  it("tallies satellites into their orbit regimes", () => {
    const catalog = makeCatalog(["LEO", "LEO", "MEO", "GEO", "GEO", "GEO"]);
    expect(countByOrbitType(catalog)).toEqual({ LEO: 2, MEO: 1, GEO: 3 });
  });

  it("returns every regime at zero for an empty catalog", () => {
    expect(countByOrbitType([])).toEqual({ LEO: 0, MEO: 0, GEO: 0 });
  });
});

describe("countByRiskLevel", () => {
  it("tallies satellites into their risk levels", () => {
    const catalog: Satellite[] = [
      makeSatellite({ noradId: 1, riskLevel: "nominal" }),
      makeSatellite({ noradId: 2, riskLevel: "nominal" }),
      makeSatellite({ noradId: 3, riskLevel: "watch" }),
      makeSatellite({ noradId: 4, riskLevel: "critical" })
    ];
    expect(countByRiskLevel(catalog)).toEqual({ nominal: 2, watch: 1, warning: 0, critical: 1 });
  });

  it("returns every level at zero for an empty catalog", () => {
    expect(countByRiskLevel([])).toEqual({ nominal: 0, watch: 0, warning: 0, critical: 0 });
  });
});

describe("averageAltitudeKm", () => {
  it("averages the catalog altitude", () => {
    const catalog = [
      makeSatellite({ noradId: 1, altitudeKm: 500 }),
      makeSatellite({ noradId: 2, altitudeKm: 700 }),
      makeSatellite({ noradId: 3, altitudeKm: 1200 })
    ];
    expect(averageAltitudeKm(catalog)).toBe(800);
  });

  it("returns 0 for an empty catalog rather than NaN", () => {
    expect(averageAltitudeKm([])).toBe(0);
  });
});

describe("averageVelocityKms", () => {
  it("averages the catalog velocity", () => {
    const catalog = [
      makeSatellite({ noradId: 1, velocityKms: 7.4 }),
      makeSatellite({ noradId: 2, velocityKms: 7.8 })
    ];
    expect(averageVelocityKms(catalog)).toBeCloseTo(7.6, 10);
  });

  it("returns 0 for an empty catalog rather than NaN", () => {
    expect(averageVelocityKms([])).toBe(0);
  });
});

describe("totalConjunctions", () => {
  it("sums per-satellite conjunction counts", () => {
    const catalog = [
      makeSatellite({ noradId: 1, conjunctionCount: 2 }),
      makeSatellite({ noradId: 2, conjunctionCount: 0 }),
      makeSatellite({ noradId: 3, conjunctionCount: 5 })
    ];
    expect(totalConjunctions(catalog)).toBe(7);
  });

  it("returns 0 for an empty catalog", () => {
    expect(totalConjunctions([])).toBe(0);
  });
});
