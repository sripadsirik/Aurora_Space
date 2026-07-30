import { describe, expect, it } from "vitest";
import type { OrbitType, RiskLevel, Satellite } from "../../types/space";
import {
  averageAltitudeKm,
  averageVelocityKms,
  countByOrbitType,
  countByRiskLevel,
  countElevatedRisk,
  summarizeCatalog,
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

describe("countElevatedRisk", () => {
  const catalog = [
    makeSatellite({ noradId: 1, riskLevel: "nominal" }),
    makeSatellite({ noradId: 2, riskLevel: "watch" }),
    makeSatellite({ noradId: 3, riskLevel: "warning" }),
    makeSatellite({ noradId: 4, riskLevel: "critical" })
  ];

  it("counts satellites above nominal by default", () => {
    expect(countElevatedRisk(catalog)).toBe(3);
  });

  it("honours a higher threshold", () => {
    expect(countElevatedRisk(catalog, "warning")).toBe(2);
    expect(countElevatedRisk(catalog, "critical")).toBe(1);
  });

  it("counts the whole catalog at the nominal threshold", () => {
    expect(countElevatedRisk(catalog, "nominal")).toBe(4);
  });
});

describe("summarizeCatalog", () => {
  const catalog = [
    makeSatellite({ noradId: 1, orbitType: "LEO", riskLevel: "nominal", altitudeKm: 500, velocityKms: 7.6, conjunctionCount: 1 }),
    makeSatellite({ noradId: 2, orbitType: "LEO", riskLevel: "watch", altitudeKm: 600, velocityKms: 7.5, conjunctionCount: 2 }),
    makeSatellite({ noradId: 3, orbitType: "GEO", riskLevel: "critical", altitudeKm: 35786, velocityKms: 3.07, conjunctionCount: 0 })
  ];

  it("bundles every aggregate consistently with the individual helpers", () => {
    const summary = summarizeCatalog(catalog);
    expect(summary.total).toBe(3);
    expect(summary.byOrbitType).toEqual(countByOrbitType(catalog));
    expect(summary.byRiskLevel).toEqual(countByRiskLevel(catalog));
    expect(summary.averageAltitudeKm).toBe(averageAltitudeKm(catalog));
    expect(summary.averageVelocityKms).toBe(averageVelocityKms(catalog));
    expect(summary.totalConjunctions).toBe(totalConjunctions(catalog));
    expect(summary.elevatedRisk).toBe(countElevatedRisk(catalog));
  });

  it("produces a fully zeroed summary for an empty catalog", () => {
    expect(summarizeCatalog([])).toEqual({
      total: 0,
      byOrbitType: { LEO: 0, MEO: 0, GEO: 0 },
      byRiskLevel: { nominal: 0, watch: 0, warning: 0, critical: 0 },
      averageAltitudeKm: 0,
      averageVelocityKms: 0,
      totalConjunctions: 0,
      elevatedRisk: 0
    });
  });
});
