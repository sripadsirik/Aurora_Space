import { describe, expect, it } from "vitest";
import { isCriticalConjunction } from "../../../utils/format";
import { mockConjunctions } from "../conjunctions";
import { mockSatellites } from "../satellites";

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

  it("classifies every critical-risk conjunction as critical", () => {
    const critical = mockConjunctions.filter((conjunction) => conjunction.riskLevel === "critical");
    expect(critical.length).toBeGreaterThan(0);
    for (const conjunction of critical) {
      expect(isCriticalConjunction(conjunction)).toBe(true);
    }
  });

  it("references satellites that exist in the catalog with matching names", () => {
    const byId = new Map(mockSatellites.map((satellite) => [satellite.noradId, satellite.name]));
    for (const conjunction of mockConjunctions) {
      for (const object of [conjunction.object1, conjunction.object2]) {
        expect(byId.has(object.noradId)).toBe(true);
        expect(byId.get(object.noradId)).toBe(object.name);
      }
    }
  });
});
