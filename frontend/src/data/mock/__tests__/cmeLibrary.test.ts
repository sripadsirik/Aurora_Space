import { describe, expect, it } from "vitest";
import { mockCMEs } from "../cmeLibrary";

describe("mockCMEs dataset", () => {
  it("uses contiguous ids matching each entry's array index", () => {
    mockCMEs.forEach((cme, index) => {
      expect(cme.id).toBe(index);
    });
  });

  it("gives every CME a positive speed", () => {
    for (const cme of mockCMEs) {
      expect(cme.speed).toBeGreaterThan(0);
    }
  });

});
