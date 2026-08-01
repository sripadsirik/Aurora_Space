import { describe, expect, it } from "vitest";
import type { Satellite } from "../../types/space";
import { filterByOrbitType, filterByRiskLevel } from "../catalogFilters";

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

describe("filterByOrbitType", () => {
  it("keeps only satellites in the requested regime", () => {
    const catalog = [
      makeSatellite({ noradId: 1, orbitType: "LEO" }),
      makeSatellite({ noradId: 2, orbitType: "GEO" }),
      makeSatellite({ noradId: 3, orbitType: "LEO" })
    ];
    expect(filterByOrbitType(catalog, "LEO").map((s) => s.noradId)).toEqual([1, 3]);
  });

  it("returns an empty array when no satellite matches", () => {
    const catalog = [makeSatellite({ orbitType: "LEO" })];
    expect(filterByOrbitType(catalog, "MEO")).toEqual([]);
  });

  it("does not mutate the input array", () => {
    const catalog = [makeSatellite({ orbitType: "LEO" })];
    filterByOrbitType(catalog, "LEO");
    expect(catalog).toHaveLength(1);
  });
});

describe("filterByRiskLevel", () => {
  it("keeps only satellites carrying the requested risk level", () => {
    const catalog = [
      makeSatellite({ noradId: 1, riskLevel: "nominal" }),
      makeSatellite({ noradId: 2, riskLevel: "critical" }),
      makeSatellite({ noradId: 3, riskLevel: "critical" })
    ];
    expect(filterByRiskLevel(catalog, "critical").map((s) => s.noradId)).toEqual([2, 3]);
  });

  it("returns an empty array when no satellite matches", () => {
    const catalog = [makeSatellite({ riskLevel: "nominal" })];
    expect(filterByRiskLevel(catalog, "warning")).toEqual([]);
  });
});
