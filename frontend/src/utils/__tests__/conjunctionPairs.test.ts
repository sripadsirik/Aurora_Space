import { describe, expect, it } from "vitest";
import { Color } from "cesium";
import { conjunctionPairColor, conjunctionPairStyle, orderedConjunctionPairs } from "../conjunctionPairs";
import { mockConjunctions } from "../../data/mock/conjunctions";

describe("conjunction pair exploration", () => {
  it("keeps every orbit visible when highlighting a pair in All paths", () => {
    expect(conjunctionPairStyle("other", "selected", false).visible).toBe(true);
    expect(conjunctionPairStyle("selected", "selected", false).opacity).toBeGreaterThan(conjunctionPairStyle("other", "selected", false).opacity);
  });
  it("isolates only on request and recovers all paths when the selection disappears", () => {
    expect(conjunctionPairStyle("other", "selected", true).visible).toBe(false);
    expect(conjunctionPairStyle("selected", "selected", true).visible).toBe(true);
    expect(conjunctionPairStyle("other", null, true).visible).toBe(true);
  });
  it("uses the same parseable pair color regardless of input ordering", () => {
    const before = [...mockConjunctions];
    const pairs = orderedConjunctionPairs(mockConjunctions);
    expect(mockConjunctions).toEqual(before);
    expect(orderedConjunctionPairs([...mockConjunctions].reverse())).toEqual(pairs);
    for (const pair of pairs) {
      expect(pair.color).toBe(conjunctionPairColor(pair.conjunction.id));
      expect(Color.fromCssColorString(pair.color)).toBeDefined();
    }
  });
});
