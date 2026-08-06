import { describe, expect, it } from "vitest";
import type { ConjunctionWarning } from "../../types/space";
import { countConjunctionsByRisk } from "../conjunctionStats";

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
