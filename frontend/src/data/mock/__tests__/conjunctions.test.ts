import { describe, expect, it } from "vitest";
import { mockConjunctions } from "../conjunctions";

describe("mockConjunctions dataset", () => {
  it("assigns a unique id to every conjunction", () => {
    const ids = mockConjunctions.map((conjunction) => conjunction.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
