import { describe, expect, it } from "vitest";
import type { Satellite } from "../../types/space";
import { countByOwner, normalizeOwner } from "../catalogOwners";

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
