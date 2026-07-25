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

  it("carries an off-axis azimuth for every non-impacting CME", () => {
    const misses = mockCMEs.filter((cme) => cme.impactStatus === "NO IMPACT — MISS");
    expect(misses.length).toBeGreaterThan(0);
    for (const cme of misses) {
      expect(cme.azimuthFromEarth).toBeTypeOf("number");
      expect(cme.note).toBeTypeOf("string");
    }
  });
});
