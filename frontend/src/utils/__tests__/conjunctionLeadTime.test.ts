import { describe, expect, it } from "vitest";
import {
  CONJUNCTION_LEAD_TIME_BUCKETS,
  CONJUNCTION_LEAD_TIME_THRESHOLDS_MINUTES,
  classifyConjunctionLeadTime,
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

describe("classifyConjunctionLeadTime", () => {
  it("buckets an elapsed TCA as passed", () => {
    expect(classifyConjunctionLeadTime(inMinutes(-1), now)).toBe("passed");
  });

  it("buckets a TCA within the hour as imminent", () => {
    expect(classifyConjunctionLeadTime(inMinutes(30), now)).toBe("imminent");
  });

  it("buckets a TCA a few hours out as soon", () => {
    expect(classifyConjunctionLeadTime(inMinutes(180), now)).toBe("soon");
  });

  it("buckets a TCA later in the day as upcoming", () => {
    expect(classifyConjunctionLeadTime(inMinutes(720), now)).toBe("upcoming");
  });

  it("buckets a TCA beyond a day as later", () => {
    expect(classifyConjunctionLeadTime(inMinutes(2000), now)).toBe("later");
  });

  it("treats each window's upper edge as inclusive", () => {
    const { imminent, soon, upcoming } = CONJUNCTION_LEAD_TIME_THRESHOLDS_MINUTES;
    expect(classifyConjunctionLeadTime(inMinutes(imminent), now)).toBe("imminent");
    expect(classifyConjunctionLeadTime(inMinutes(soon), now)).toBe("soon");
    expect(classifyConjunctionLeadTime(inMinutes(upcoming), now)).toBe("upcoming");
  });

  it("treats an exactly-now TCA as imminent", () => {
    expect(classifyConjunctionLeadTime(now, now)).toBe("imminent");
  });
});

describe("CONJUNCTION_LEAD_TIME_BUCKETS", () => {
  it("lists every bucket once, most urgent first", () => {
    expect(CONJUNCTION_LEAD_TIME_BUCKETS).toEqual([
      "passed",
      "imminent",
      "soon",
      "upcoming",
      "later"
    ]);
  });
});
