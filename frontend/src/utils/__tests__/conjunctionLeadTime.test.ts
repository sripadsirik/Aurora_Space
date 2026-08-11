import { describe, expect, it } from "vitest";
import {
  CONJUNCTION_LEAD_TIME_THRESHOLDS_MINUTES,
  leadTimeMinutes
} from "../conjunctionLeadTime";

const now = new Date("2026-08-11T12:00:00Z");
const inMinutes = (minutes: number): Date => new Date(now.getTime() + minutes * 60_000);

describe("CONJUNCTION_LEAD_TIME_THRESHOLDS_MINUTES", () => {
  it("orders the window boundaries from soonest to furthest", () => {
    const { imminent, soon, upcoming } = CONJUNCTION_LEAD_TIME_THRESHOLDS_MINUTES;
    expect(imminent).toBeLessThan(soon);
    expect(soon).toBeLessThan(upcoming);
  });
});

describe("leadTimeMinutes", () => {
  it("returns positive minutes for a future TCA", () => {
    expect(leadTimeMinutes(inMinutes(90), now)).toBe(90);
  });

  it("returns negative minutes for an elapsed TCA", () => {
    expect(leadTimeMinutes(inMinutes(-30), now)).toBe(-30);
  });

  it("returns zero when the TCA is exactly now", () => {
    expect(leadTimeMinutes(now, now)).toBe(0);
  });

  it("accepts an ISO string for the TCA", () => {
    expect(leadTimeMinutes(inMinutes(15).toISOString(), now)).toBe(15);
  });

  it("does not round the result", () => {
    expect(leadTimeMinutes(new Date(now.getTime() + 30_000), now)).toBe(0.5);
  });
});
