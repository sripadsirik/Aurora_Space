import { describe, expect, it } from "vitest";
import type { Satellite } from "../../types/space";
import { countByOwner, normalizeOwner, topOwnersByCount, uniqueOwners } from "../catalogOwners";

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

const makeCatalog = (owners: string[]): Satellite[] =>
  owners.map((owner, index) => makeSatellite({ noradId: index + 1, owner }));

describe("normalizeOwner", () => {
  it("trims surrounding whitespace and folds case", () => {
    expect(normalizeOwner("  SpaceX ")).toBe("spacex");
  });

  it("leaves an already-normalised label unchanged", () => {
    expect(normalizeOwner("nasa")).toBe("nasa");
  });
});

describe("countByOwner", () => {
  it("tallies satellites by operator", () => {
    const catalog = makeCatalog(["SpaceX", "SpaceX", "NASA", "ESA"]);
    expect(countByOwner(catalog)).toEqual({ SpaceX: 2, NASA: 1, ESA: 1 });
  });

  it("collapses spacing and case differences onto one bucket", () => {
    const catalog = makeCatalog(["SpaceX", " spacex ", "SPACEX"]);
    expect(countByOwner(catalog)).toEqual({ SpaceX: 3 });
  });

  it("keeps the first-seen spelling as the display key", () => {
    const catalog = makeCatalog([" NASA", "nasa"]);
    expect(countByOwner(catalog)).toEqual({ NASA: 2 });
  });

  it("returns an empty record for an empty catalog", () => {
    expect(countByOwner([])).toEqual({});
  });
});

describe("uniqueOwners", () => {
  it("lists distinct operators sorted case-insensitively", () => {
    const catalog = makeCatalog(["SpaceX", "ESA", "NASA", "SpaceX"]);
    expect(uniqueOwners(catalog)).toEqual(["ESA", "NASA", "SpaceX"]);
  });

  it("de-duplicates spacing and case variants", () => {
    const catalog = makeCatalog(["NASA", " nasa", "NASA "]);
    expect(uniqueOwners(catalog)).toEqual(["NASA"]);
  });

  it("returns an empty list for an empty catalog", () => {
    expect(uniqueOwners([])).toEqual([]);
  });
});

describe("topOwnersByCount", () => {
  it("ranks operators from largest to smallest fleet", () => {
    const catalog = makeCatalog(["SpaceX", "SpaceX", "SpaceX", "NASA", "NASA", "ESA"]);
    expect(topOwnersByCount(catalog)).toEqual([
      { owner: "SpaceX", count: 3 },
      { owner: "NASA", count: 2 },
      { owner: "ESA", count: 1 }
    ]);
  });

  it("breaks count ties alphabetically", () => {
    const catalog = makeCatalog(["NASA", "ESA", "CNSA"]);
    expect(topOwnersByCount(catalog)).toEqual([
      { owner: "CNSA", count: 1 },
      { owner: "ESA", count: 1 },
      { owner: "NASA", count: 1 }
    ]);
  });

  it("keeps only the busiest N operators when a limit is given", () => {
    const catalog = makeCatalog(["SpaceX", "SpaceX", "SpaceX", "NASA", "NASA", "ESA"]);
    expect(topOwnersByCount(catalog, 2)).toEqual([
      { owner: "SpaceX", count: 3 },
      { owner: "NASA", count: 2 }
    ]);
  });

  it("returns every operator when the limit is non-positive", () => {
    const catalog = makeCatalog(["SpaceX", "NASA"]);
    expect(topOwnersByCount(catalog, 0)).toHaveLength(2);
  });

  it("returns an empty list for an empty catalog", () => {
    expect(topOwnersByCount([])).toEqual([]);
  });
});
