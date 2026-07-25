import { describe, expect, it } from "vitest";
import { mockConjunctions } from "../conjunctions";

describe("mockConjunctions dataset", () => {
  it("assigns a unique id to every conjunction", () => {
    const ids = mockConjunctions.map((conjunction) => conjunction.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps the metre miss distance consistent with the kilometre value", () => {
    for (const conjunction of mockConjunctions) {
      expect(conjunction.missDistanceM).toBeCloseTo(conjunction.missDistanceKm * 1000, 3);
    }
  });

  it("mirrors the collision probability in both pc and probability fields", () => {
    for (const conjunction of mockConjunctions) {
      expect(conjunction.pc).toBe(conjunction.probability);
    }
  });
});
