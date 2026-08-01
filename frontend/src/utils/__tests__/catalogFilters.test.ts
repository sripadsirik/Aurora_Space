import { describe, expect, it } from "vitest";
import type { Satellite } from "../../types/space";
import {
  filterByAltitudeRange,
  filterByOrbitType,
  filterByOwner,
  filterByRiskLevel,
  searchCatalog
} from "../catalogFilters";

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

describe("filterByOwner", () => {
  it("matches owners case-insensitively and ignores surrounding whitespace", () => {
    const catalog = [
      makeSatellite({ noradId: 1, owner: "NASA" }),
      makeSatellite({ noradId: 2, owner: "ESA" }),
      makeSatellite({ noradId: 3, owner: " nasa " })
    ];
    expect(filterByOwner(catalog, "nasa").map((s) => s.noradId)).toEqual([1, 3]);
  });

  it("returns an empty array when the owner is not present", () => {
    const catalog = [makeSatellite({ owner: "NASA" })];
    expect(filterByOwner(catalog, "SPACEX")).toEqual([]);
  });
});

describe("filterByAltitudeRange", () => {
  const catalog = [
    makeSatellite({ noradId: 1, altitudeKm: 400 }),
    makeSatellite({ noradId: 2, altitudeKm: 2000 }),
    makeSatellite({ noradId: 3, altitudeKm: 35786 })
  ];

  it("keeps satellites within the inclusive band", () => {
    expect(filterByAltitudeRange(catalog, 400, 2000).map((s) => s.noradId)).toEqual([1, 2]);
  });

  it("treats the bounds as inclusive", () => {
    expect(filterByAltitudeRange(catalog, 2000, 2000).map((s) => s.noradId)).toEqual([2]);
  });

  it("normalises swapped bounds", () => {
    expect(filterByAltitudeRange(catalog, 2000, 400).map((s) => s.noradId)).toEqual([1, 2]);
  });
});

describe("searchCatalog", () => {
  const catalog = [
    makeSatellite({ noradId: 25544, name: "ISS (ZARYA)" }),
    makeSatellite({ noradId: 20580, name: "HST" }),
    makeSatellite({ noradId: 43013, name: "NOAA 20" })
  ];

  it("matches on a case-insensitive name substring", () => {
    expect(searchCatalog(catalog, "iss").map((s) => s.noradId)).toEqual([25544]);
  });

  it("matches on a NORAD id substring", () => {
    expect(searchCatalog(catalog, "544").map((s) => s.noradId)).toEqual([25544]);
  });

  it("returns a copy of the catalog for a blank query", () => {
    const result = searchCatalog(catalog, "   ");
    expect(result).toHaveLength(3);
    expect(result).not.toBe(catalog);
  });

  it("returns an empty array when nothing matches", () => {
    expect(searchCatalog(catalog, "starlink")).toEqual([]);
  });
});
