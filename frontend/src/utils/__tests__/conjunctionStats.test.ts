import { describe, expect, it } from "vitest";
import type { ConjunctionWarning } from "../../types/space";
import {
  averageMissDistanceKm,
  closestApproach,
  countActionableConjunctions,
  countConjunctionsByRisk,
  highestProbabilityConjunction,
  soonestTca
} from "../conjunctionStats";

const makeConjunction = (overrides: Partial<ConjunctionWarning> = {}): ConjunctionWarning => ({
  id: "c1",
  object1: { noradId: 1, name: "SAT-A" },
  object2: { noradId: 2, name: "SAT-B" },
  tca: new Date("2026-08-06T00:00:00Z"),
  missDistanceKm: 1,
  missDistanceM: 1000,
  pc: 1e-5,
  probability: 1e-5,
  relativeVelocityKms: 10,
  riskLevel: "watch",
  ...overrides
});

describe("countConjunctionsByRisk", () => {
  it("tallies conjunctions into risk tiers derived from probability", () => {
    const conjunctions = [
      makeConjunction({ id: "a", probability: 2e-3 }), // critical
      makeConjunction({ id: "b", probability: 5e-4 }), // warning
      makeConjunction({ id: "c", probability: 5e-6 }), // watch
      makeConjunction({ id: "d", probability: 1e-9 }) // nominal
    ];
    expect(countConjunctionsByRisk(conjunctions)).toEqual({
      nominal: 1,
      watch: 1,
      warning: 1,
      critical: 1
    });
  });

  it("returns every tier at zero for an empty feed", () => {
    expect(countConjunctionsByRisk([])).toEqual({
      nominal: 0,
      watch: 0,
      warning: 0,
      critical: 0
    });
  });
});

describe("countActionableConjunctions", () => {
  it("counts only warning and critical tiers", () => {
    const conjunctions = [
      makeConjunction({ id: "a", probability: 2e-3 }), // critical
      makeConjunction({ id: "b", probability: 5e-4 }), // warning
      makeConjunction({ id: "c", probability: 5e-6 }), // watch
      makeConjunction({ id: "d", probability: 1e-9 }) // nominal
    ];
    expect(countActionableConjunctions(conjunctions)).toBe(2);
  });

  it("returns zero for an empty feed", () => {
    expect(countActionableConjunctions([])).toBe(0);
  });
});

describe("closestApproach", () => {
  it("returns the conjunction with the smallest miss distance", () => {
    const near = makeConjunction({ id: "near", missDistanceM: 120 });
    const conjunctions = [
      makeConjunction({ id: "far", missDistanceM: 5000 }),
      near,
      makeConjunction({ id: "mid", missDistanceM: 900 })
    ];
    expect(closestApproach(conjunctions)).toBe(near);
  });

  it("returns null for an empty feed", () => {
    expect(closestApproach([])).toBeNull();
  });
});

describe("soonestTca", () => {
  it("returns the conjunction with the earliest TCA", () => {
    const first = makeConjunction({ id: "first", tca: new Date("2026-08-06T01:00:00Z") });
    const conjunctions = [
      makeConjunction({ id: "late", tca: new Date("2026-08-06T09:00:00Z") }),
      first,
      makeConjunction({ id: "mid", tca: new Date("2026-08-06T04:00:00Z") })
    ];
    expect(soonestTca(conjunctions)).toBe(first);
  });

  it("returns null for an empty feed", () => {
    expect(soonestTca([])).toBeNull();
  });
});

describe("highestProbabilityConjunction", () => {
  it("returns the most probable conjunction", () => {
    const worst = makeConjunction({ id: "worst", probability: 4e-3 });
    const conjunctions = [
      makeConjunction({ id: "low", probability: 1e-6 }),
      worst,
      makeConjunction({ id: "mid", probability: 2e-4 })
    ];
    expect(highestProbabilityConjunction(conjunctions)).toBe(worst);
  });

  it("returns null for an empty feed", () => {
    expect(highestProbabilityConjunction([])).toBeNull();
  });
});

describe("averageMissDistanceKm", () => {
  it("averages the miss distances", () => {
    const conjunctions = [
      makeConjunction({ id: "a", missDistanceKm: 2 }),
      makeConjunction({ id: "b", missDistanceKm: 4 }),
      makeConjunction({ id: "c", missDistanceKm: 6 })
    ];
    expect(averageMissDistanceKm(conjunctions)).toBe(4);
  });

  it("returns 0 for an empty feed rather than NaN", () => {
    expect(averageMissDistanceKm([])).toBe(0);
  });
});
