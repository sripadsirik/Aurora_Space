import { describe, expect, it } from "vitest";
import type { RiskLevel, Satellite } from "../../types/space";
import {
  UNKNOWN_OWNER,
  canonicalOwner,
  conjunctionsByOwner,
  countByOwner,
  elevatedRiskByOwner,
  normalizeOwner,
  ownerRank,
  ownerShare,
  OWNER_LEADERBOARD_SIZE,
  summarizeOwners,
  topOwnersByConjunctions,
  topOwnersByCount,
  uniqueOwners
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

describe("conjunctionsByOwner", () => {
  it("sums active conjunction counts per operator", () => {
    const catalog = [
      makeSatellite({ noradId: 1, owner: "SpaceX", conjunctionCount: 2 }),
      makeSatellite({ noradId: 2, owner: "SpaceX", conjunctionCount: 3 }),
      makeSatellite({ noradId: 3, owner: "NASA", conjunctionCount: 1 })
    ];
    expect(conjunctionsByOwner(catalog)).toEqual({ SpaceX: 5, NASA: 1 });
  });

  it("groups spacing and case variants under one operator", () => {
    const catalog = [
      makeSatellite({ noradId: 1, owner: "ESA", conjunctionCount: 1 }),
      makeSatellite({ noradId: 2, owner: " esa ", conjunctionCount: 4 })
    ];
    expect(conjunctionsByOwner(catalog)).toEqual({ ESA: 5 });
  });

  it("returns an empty record for an empty catalog", () => {
    expect(conjunctionsByOwner([])).toEqual({});
  });
});

describe("ownerShare", () => {
  it("returns the fraction of the catalog an operator owns", () => {
    const catalog = makeCatalog(["SpaceX", "SpaceX", "NASA", "ESA"]);
    expect(ownerShare(catalog, "SpaceX")).toBe(0.5);
    expect(ownerShare(catalog, "NASA")).toBe(0.25);
  });

  it("matches the owner case-insensitively and ignoring whitespace", () => {
    const catalog = makeCatalog(["NASA", "NASA", "ESA", "ESA"]);
    expect(ownerShare(catalog, " nasa ")).toBe(0.5);
  });

  it("returns 0 for an owner absent from the catalog", () => {
    const catalog = makeCatalog(["SpaceX", "NASA"]);
    expect(ownerShare(catalog, "ESA")).toBe(0);
  });

  it("returns 0 for an empty catalog rather than NaN", () => {
    expect(ownerShare([], "SpaceX")).toBe(0);
  });
});

describe("topOwnersByConjunctions", () => {
  it("ranks operators from most to fewest active conjunctions", () => {
    const catalog = [
      makeSatellite({ noradId: 1, owner: "SpaceX", conjunctionCount: 1 }),
      makeSatellite({ noradId: 2, owner: "SpaceX", conjunctionCount: 1 }),
      makeSatellite({ noradId: 3, owner: "NASA", conjunctionCount: 5 }),
      makeSatellite({ noradId: 4, owner: "ESA", conjunctionCount: 0 })
    ];
    expect(topOwnersByConjunctions(catalog)).toEqual([
      { owner: "NASA", conjunctions: 5 },
      { owner: "SpaceX", conjunctions: 2 },
      { owner: "ESA", conjunctions: 0 }
    ]);
  });

  it("breaks conjunction ties alphabetically", () => {
    const catalog = [
      makeSatellite({ noradId: 1, owner: "NASA", conjunctionCount: 2 }),
      makeSatellite({ noradId: 2, owner: "ESA", conjunctionCount: 2 })
    ];
    expect(topOwnersByConjunctions(catalog)).toEqual([
      { owner: "ESA", conjunctions: 2 },
      { owner: "NASA", conjunctions: 2 }
    ]);
  });

  it("keeps only the top N operators when a limit is given", () => {
    const catalog = [
      makeSatellite({ noradId: 1, owner: "SpaceX", conjunctionCount: 3 }),
      makeSatellite({ noradId: 2, owner: "NASA", conjunctionCount: 2 }),
      makeSatellite({ noradId: 3, owner: "ESA", conjunctionCount: 1 })
    ];
    expect(topOwnersByConjunctions(catalog, 1)).toEqual([{ owner: "SpaceX", conjunctions: 3 }]);
  });

  it("returns an empty list for an empty catalog", () => {
    expect(topOwnersByConjunctions([])).toEqual([]);
  });
});

describe("summarizeOwners", () => {
  it("bundles owner aggregates consistently", () => {
    const catalog = makeCatalog(["SpaceX", "SpaceX", "NASA", "ESA"]);
    const summary = summarizeOwners(catalog);
    expect(summary.totalOwners).toBe(3);
    expect(summary.byOwner).toEqual({ SpaceX: 2, NASA: 1, ESA: 1 });
    expect(summary.largestOwner).toEqual({ owner: "SpaceX", count: 2 });
  });

  it("caps the leaderboard at OWNER_LEADERBOARD_SIZE entries", () => {
    const owners = Array.from({ length: OWNER_LEADERBOARD_SIZE + 3 }, (_, i) => `OP-${i}`);
    const summary = summarizeOwners(makeCatalog(owners));
    expect(summary.topOwners).toHaveLength(OWNER_LEADERBOARD_SIZE);
    expect(summary.totalOwners).toBe(OWNER_LEADERBOARD_SIZE + 3);
  });

  it("reports a null largest owner and zero total for an empty catalog", () => {
    const summary = summarizeOwners([]);
    expect(summary.totalOwners).toBe(0);
    expect(summary.byOwner).toEqual({});
    expect(summary.topOwners).toEqual([]);
    expect(summary.largestOwner).toBeNull();
  });
});

describe("canonicalOwner", () => {
  it("trims surrounding whitespace", () => {
    expect(canonicalOwner("  SpaceX  ")).toBe("SpaceX");
  });

  it("collapses a blank owner to the UNKNOWN label", () => {
    expect(canonicalOwner("   ")).toBe(UNKNOWN_OWNER);
    expect(canonicalOwner("")).toBe(UNKNOWN_OWNER);
  });
});

describe("blank owner bucketing", () => {
  it("groups blank owners under the UNKNOWN label", () => {
    const catalog = makeCatalog(["SpaceX", "", "   "]);
    expect(countByOwner(catalog)).toEqual({ SpaceX: 1, [UNKNOWN_OWNER]: 2 });
  });

  it("addresses the UNKNOWN bucket from a blank or explicit argument", () => {
    const catalog = makeCatalog(["SpaceX", "", "  "]);
    expect(ownerShare(catalog, "")).toBeCloseTo(2 / 3);
    expect(ownerShare(catalog, UNKNOWN_OWNER)).toBeCloseTo(2 / 3);
    expect(ownerRank(catalog, "")).toBe(1);
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
    expect(ownerRank(makeCatalog(["NASA"]), "SpaceX")).toBeNull();
  });

  it("matches owners case- and whitespace-insensitively", () => {
    const catalog = makeCatalog(["SpaceX", "SpaceX", "NASA"]);
    expect(ownerRank(catalog, "  spacex ")).toBe(1);
  });

  it("returns null for an empty catalog", () => {
    expect(ownerRank([], "NASA")).toBeNull();
  });
});

describe("elevatedRiskByOwner", () => {
  const makeFlagged = (rows: Array<[string, RiskLevel]>): Satellite[] =>
    rows.map(([owner, riskLevel], index) =>
      makeSatellite({ noradId: index + 1, owner, riskLevel })
    );

  it("counts only objects at or above the default watch threshold, per owner", () => {
    const catalog = makeFlagged([
      ["SpaceX", "critical"],
      ["SpaceX", "warning"],
      ["SpaceX", "nominal"],
      ["NASA", "watch"],
      ["ESA", "nominal"]
    ]);
    expect(elevatedRiskByOwner(catalog)).toEqual([
      { owner: "SpaceX", count: 2 },
      { owner: "NASA", count: 1 }
    ]);
  });

  it("honours a stricter threshold", () => {
    const catalog = makeFlagged([
      ["SpaceX", "warning"],
      ["NASA", "watch"]
    ]);
    expect(elevatedRiskByOwner(catalog, "warning")).toEqual([{ owner: "SpaceX", count: 1 }]);
  });

  it("returns an empty array when nothing is flagged", () => {
    expect(elevatedRiskByOwner(makeFlagged([["SpaceX", "nominal"]]))).toEqual([]);
  });

  it("returns an empty array for an empty catalog", () => {
    expect(elevatedRiskByOwner([])).toEqual([]);
  });
});

describe("summarizeOwners largestShare", () => {
  it("reports the leading operator's share of the catalog", () => {
    const summary = summarizeOwners(makeCatalog(["SpaceX", "SpaceX", "SpaceX", "NASA"]));
    expect(summary.largestOwner).toEqual({ owner: "SpaceX", count: 3 });
    expect(summary.largestShare).toBeCloseTo(0.75);
  });

  it("reports a zero share for an empty catalog", () => {
    const summary = summarizeOwners([]);
    expect(summary.largestOwner).toBeNull();
    expect(summary.largestShare).toBe(0);
  });
});
