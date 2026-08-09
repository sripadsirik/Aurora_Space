import { describe, expect, it } from "vitest";
import type { MockCME } from "../../types/space";
import {
  countImpactingCmes,
  fastestCme,
  isImpactingCme,
  isPendingCme,
  nextArrival,
  peakPredictedKp
} from "../cmeStats";

const cme = (overrides: Partial<MockCME>): MockCME => ({
  id: 0,
  label: "CME-TEST",
  startTime: "2026-03-07 14:23 UTC",
  speed: 1000,
  arrivalTime: "2026-03-09 18:00 UTC",
  hoursUntilArrival: 12,
  predictedKp: 5,
  stormLevel: "G1",
  confidence: 60,
  direction: "Earth-directed",
  impactStatus: "DIRECT HIT",
  ...overrides
});

describe("isImpactingCme", () => {
  it("treats a direct hit as impacting", () => {
    expect(isImpactingCme(cme({ impactStatus: "DIRECT HIT" }))).toBe(true);
  });

  it("treats a glancing blow as impacting", () => {
    expect(isImpactingCme(cme({ impactStatus: "GLANCING BLOW" }))).toBe(true);
  });

  it("treats a clean miss as not impacting", () => {
    expect(isImpactingCme(cme({ impactStatus: "NO IMPACT — MISS" }))).toBe(false);
  });
});

describe("countImpactingCmes", () => {
  it("returns 0 for an empty feed", () => {
    expect(countImpactingCmes([])).toBe(0);
  });

  it("counts only the Earth-directed ejections", () => {
    const cmes = [
      cme({ id: 0, impactStatus: "DIRECT HIT" }),
      cme({ id: 1, impactStatus: "GLANCING BLOW" }),
      cme({ id: 2, impactStatus: "NO IMPACT — MISS" })
    ];
    expect(countImpactingCmes(cmes)).toBe(2);
  });

  it("returns 0 when every CME misses", () => {
    const cmes = [
      cme({ id: 0, impactStatus: "NO IMPACT — MISS" }),
      cme({ id: 1, impactStatus: "NO IMPACT — MISS" })
    ];
    expect(countImpactingCmes(cmes)).toBe(0);
  });
});

describe("isPendingCme", () => {
  it("treats an inbound direct hit as pending", () => {
    expect(isPendingCme(cme({ impactStatus: "DIRECT HIT", hoursUntilArrival: 8 }))).toBe(true);
  });

  it("excludes an already-arrived ejection", () => {
    expect(isPendingCme(cme({ impactStatus: "DIRECT HIT", hoursUntilArrival: -2 }))).toBe(false);
  });

  it("excludes a CME arriving exactly now", () => {
    expect(isPendingCme(cme({ impactStatus: "DIRECT HIT", hoursUntilArrival: 0 }))).toBe(false);
  });

  it("excludes a clean miss even with a future arrival", () => {
    expect(isPendingCme(cme({ impactStatus: "NO IMPACT — MISS", hoursUntilArrival: 36 }))).toBe(false);
  });
});

describe("nextArrival", () => {
  it("returns null for an empty feed", () => {
    expect(nextArrival([])).toBeNull();
  });

  it("returns null when nothing is inbound", () => {
    const cmes = [
      cme({ id: 0, impactStatus: "DIRECT HIT", hoursUntilArrival: -2 }),
      cme({ id: 1, impactStatus: "NO IMPACT — MISS", hoursUntilArrival: 36 })
    ];
    expect(nextArrival(cmes)).toBeNull();
  });

  it("picks the smallest positive hoursUntilArrival among inbound CMEs", () => {
    const cmes = [
      cme({ id: 0, hoursUntilArrival: 52 }),
      cme({ id: 1, hoursUntilArrival: 8 }),
      cme({ id: 2, hoursUntilArrival: 36 })
    ];
    expect(nextArrival(cmes)?.id).toBe(1);
  });

  it("ignores an arrived CME even when it has the smallest raw value", () => {
    const cmes = [
      cme({ id: 0, hoursUntilArrival: -1 }),
      cme({ id: 1, hoursUntilArrival: 12 })
    ];
    expect(nextArrival(cmes)?.id).toBe(1);
  });

  it("resolves ties to the earliest matching entry", () => {
    const cmes = [
      cme({ id: 0, hoursUntilArrival: 10 }),
      cme({ id: 1, hoursUntilArrival: 10 })
    ];
    expect(nextArrival(cmes)?.id).toBe(0);
  });
});

describe("fastestCme", () => {
  it("returns null for an empty feed", () => {
    expect(fastestCme([])).toBeNull();
  });

  it("returns the highest-speed ejection", () => {
    const cmes = [
      cme({ id: 0, speed: 1250 }),
      cme({ id: 1, speed: 2100 }),
      cme({ id: 2, speed: 780 })
    ];
    expect(fastestCme(cmes)?.id).toBe(1);
  });

  it("considers a fast miss alongside impacts", () => {
    const cmes = [
      cme({ id: 0, speed: 1000, impactStatus: "DIRECT HIT" }),
      cme({ id: 1, speed: 2500, impactStatus: "NO IMPACT — MISS" })
    ];
    expect(fastestCme(cmes)?.id).toBe(1);
  });

  it("resolves ties to the earliest matching entry", () => {
    const cmes = [cme({ id: 0, speed: 900 }), cme({ id: 1, speed: 900 })];
    expect(fastestCme(cmes)?.id).toBe(0);
  });
});

describe("peakPredictedKp", () => {
  it("returns 0 for an empty feed", () => {
    expect(peakPredictedKp([])).toBe(0);
  });

  it("returns the highest predicted Kp in the feed", () => {
    const cmes = [
      cme({ id: 0, predictedKp: 7 }),
      cme({ id: 1, predictedKp: 8 }),
      cme({ id: 2, predictedKp: 5 })
    ];
    expect(peakPredictedKp(cmes)).toBe(8);
  });

  it("stays at 0 when every CME is a Kp-0 miss", () => {
    const cmes = [
      cme({ id: 0, predictedKp: 0, impactStatus: "NO IMPACT — MISS" }),
      cme({ id: 1, predictedKp: 0, impactStatus: "NO IMPACT — MISS" })
    ];
    expect(peakPredictedKp(cmes)).toBe(0);
  });
});
