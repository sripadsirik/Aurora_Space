import { describe, expect, it } from "vitest";
import type { Satellite } from "../../types/space";
import {
  UNKNOWN_OWNER,
  canonicalOwner,
  countByOwner,
  distinctOwnerCount,
  largestOperator,
  ownerRank,
  ownerShare,
  summarizeOwnership,
  topOwners
} from "../catalogOwners";

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

describe("canonicalOwner", () => {
  it("trims surrounding whitespace", () => {
    expect(canonicalOwner("  SpaceX  ")).toBe("SpaceX");
  });

  it("collapses a blank owner to the UNKNOWN label", () => {
    expect(canonicalOwner("   ")).toBe(UNKNOWN_OWNER);
    expect(canonicalOwner("")).toBe(UNKNOWN_OWNER);
  });
});

describe("countByOwner", () => {
  it("tallies objects per operator", () => {
    const catalog = makeCatalog(["SpaceX", "SpaceX", "NASA", "ESA", "ESA", "ESA"]);
    expect(countByOwner(catalog)).toEqual([
      { owner: "ESA", count: 3 },
      { owner: "SpaceX", count: 2 },
      { owner: "NASA", count: 1 }
    ]);
  });

  it("returns an empty array for an empty catalog", () => {
    expect(countByOwner([])).toEqual([]);
  });

  it("groups owners case-insensitively and ignoring whitespace", () => {
    const catalog = makeCatalog(["SpaceX", "spacex", "  SPACEX  "]);
    expect(countByOwner(catalog)).toEqual([{ owner: "SpaceX", count: 3 }]);
  });

  it("keeps the first-seen spelling as the display label", () => {
    const catalog = makeCatalog(["esa", "ESA"]);
    expect(countByOwner(catalog)[0].owner).toBe("esa");
  });

  it("buckets blank owners under UNKNOWN", () => {
    const catalog = makeCatalog(["", "   ", "NASA"]);
    expect(countByOwner(catalog)).toEqual([
      { owner: UNKNOWN_OWNER, count: 2 },
      { owner: "NASA", count: 1 }
    ]);
  });

  it("breaks count ties alphabetically by owner label", () => {
    const catalog = makeCatalog(["Zenith", "Acme"]);
    expect(countByOwner(catalog)).toEqual([
      { owner: "Acme", count: 1 },
      { owner: "Zenith", count: 1 }
    ]);
  });

  it("does not mutate the input array", () => {
    const catalog = makeCatalog(["NASA", "ESA"]);
    const snapshot = [...catalog];
    countByOwner(catalog);
    expect(catalog).toEqual(snapshot);
  });
});

describe("distinctOwnerCount", () => {
  it("counts each operator once regardless of object count", () => {
    const catalog = makeCatalog(["SpaceX", "SpaceX", "NASA", "ESA"]);
    expect(distinctOwnerCount(catalog)).toBe(3);
  });

  it("returns 0 for an empty catalog", () => {
    expect(distinctOwnerCount([])).toBe(0);
  });

  it("collapses case and whitespace variants into one operator", () => {
    const catalog = makeCatalog(["ESA", "esa", "  ESA "]);
    expect(distinctOwnerCount(catalog)).toBe(1);
  });

  it("treats all blank owners as a single UNKNOWN operator", () => {
    const catalog = makeCatalog(["", "   ", "NASA"]);
    expect(distinctOwnerCount(catalog)).toBe(2);
  });
});

describe("topOwners", () => {
  it("returns the busiest operators in descending order", () => {
    const catalog = makeCatalog([
      "SpaceX", "SpaceX", "SpaceX", "NASA", "NASA", "ESA"
    ]);
    expect(topOwners(catalog, 2)).toEqual([
      { owner: "SpaceX", count: 3 },
      { owner: "NASA", count: 2 }
    ]);
  });

  it("defaults to the top five operators", () => {
    const catalog = makeCatalog(["A", "B", "C", "D", "E", "F"]);
    expect(topOwners(catalog)).toHaveLength(5);
  });

  it("returns an empty array for a non-positive limit", () => {
    const catalog = makeCatalog(["NASA", "ESA"]);
    expect(topOwners(catalog, 0)).toEqual([]);
    expect(topOwners(catalog, -3)).toEqual([]);
  });

  it("returns every operator when the limit exceeds the distinct count", () => {
    const catalog = makeCatalog(["NASA", "ESA"]);
    expect(topOwners(catalog, 10)).toHaveLength(2);
  });
});

describe("largestOperator", () => {
  it("returns the operator with the most tracked objects", () => {
    const catalog = makeCatalog(["SpaceX", "SpaceX", "NASA"]);
    expect(largestOperator(catalog)).toEqual({ owner: "SpaceX", count: 2 });
  });

  it("returns null for an empty catalog", () => {
    expect(largestOperator([])).toBeNull();
  });

  it("breaks ties alphabetically by owner label", () => {
    const catalog = makeCatalog(["Zenith", "Acme"]);
    expect(largestOperator(catalog)).toEqual({ owner: "Acme", count: 1 });
  });
});

describe("ownerShare", () => {
  it("returns the fraction of the catalog held by an operator", () => {
    const catalog = makeCatalog(["SpaceX", "SpaceX", "SpaceX", "NASA"]);
    expect(ownerShare(catalog, "SpaceX")).toBeCloseTo(0.75);
    expect(ownerShare(catalog, "NASA")).toBeCloseTo(0.25);
  });

  it("matches owners case- and whitespace-insensitively", () => {
    const catalog = makeCatalog(["ESA", "esa", "NASA"]);
    expect(ownerShare(catalog, "  esa ")).toBeCloseTo(2 / 3);
  });

  it("returns 0 for an operator not in the catalog", () => {
    const catalog = makeCatalog(["NASA", "ESA"]);
    expect(ownerShare(catalog, "SpaceX")).toBe(0);
  });

  it("returns 0 for an empty catalog", () => {
    expect(ownerShare([], "NASA")).toBe(0);
  });

  it("matches a blank argument against the UNKNOWN bucket", () => {
    const catalog = makeCatalog(["", "NASA"]);
    expect(ownerShare(catalog, "")).toBeCloseTo(0.5);
  });
});

describe("ownerRank", () => {
  it("ranks operators from busiest to least busy", () => {
    const catalog = makeCatalog(["SpaceX", "SpaceX", "SpaceX", "NASA", "NASA", "ESA"]);
    expect(ownerRank(catalog, "SpaceX")).toBe(1);
    expect(ownerRank(catalog, "NASA")).toBe(2);
    expect(ownerRank(catalog, "ESA")).toBe(3);
  });

  it("returns null for an operator not in the catalog", () => {
    const catalog = makeCatalog(["NASA"]);
    expect(ownerRank(catalog, "SpaceX")).toBeNull();
  });

  it("matches owners case- and whitespace-insensitively", () => {
    const catalog = makeCatalog(["SpaceX", "SpaceX", "NASA"]);
    expect(ownerRank(catalog, "  spacex ")).toBe(1);
  });

  it("returns null for an empty catalog", () => {
    expect(ownerRank([], "NASA")).toBeNull();
  });
});

describe("summarizeOwnership", () => {
  it("bundles every aggregate consistently", () => {
    const catalog = makeCatalog([
      "SpaceX", "SpaceX", "SpaceX", "NASA", "NASA", "ESA"
    ]);
    const summary = summarizeOwnership(catalog);
    expect(summary.total).toBe(6);
    expect(summary.distinctOwners).toBe(3);
    expect(summary.top).toEqual([
      { owner: "SpaceX", count: 3 },
      { owner: "NASA", count: 2 },
      { owner: "ESA", count: 1 }
    ]);
    expect(summary.largest).toEqual({ owner: "SpaceX", count: 3 });
    expect(summary.largestShare).toBeCloseTo(0.5);
  });

  it("honours the topLimit argument", () => {
    const catalog = makeCatalog(["A", "B", "C", "D"]);
    expect(summarizeOwnership(catalog, 2).top).toHaveLength(2);
  });

  it("returns a safe zeroed summary for an empty catalog", () => {
    expect(summarizeOwnership([])).toEqual({
      total: 0,
      distinctOwners: 0,
      top: [],
      largest: null,
      largestShare: 0
    });
  });
});
