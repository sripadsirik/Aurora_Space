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

  it("keeps forecast confidence within a 0-100 percentage", () => {
    for (const cme of mockCMEs) {
      expect(cme.confidence).toBeGreaterThanOrEqual(0);
      expect(cme.confidence).toBeLessThanOrEqual(100);
    }
  });

  it("only uses known impact statuses", () => {
    const statuses = new Set(["DIRECT HIT", "GLANCING BLOW", "NO IMPACT — MISS"]);
    for (const cme of mockCMEs) {
      expect(statuses.has(cme.impactStatus)).toBe(true);
    }
  });
});
