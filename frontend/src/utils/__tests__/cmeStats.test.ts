import { describe, expect, it } from "vitest";
import type { MockCME } from "../../types/space";
import { isImpactingCme } from "../cmeStats";

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
