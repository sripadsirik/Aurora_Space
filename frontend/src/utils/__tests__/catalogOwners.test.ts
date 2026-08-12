import { describe, expect, it } from "vitest";
import type { Satellite } from "../../types/space";
import {
  UNKNOWN_OWNER,
  canonicalOwner,
  countByOwner
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
