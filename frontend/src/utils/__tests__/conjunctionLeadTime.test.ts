import { describe, expect, it } from "vitest";
import type { ConjunctionWarning } from "../../types/space";
import {
  CONJUNCTION_LEAD_TIME_BUCKETS,
  CONJUNCTION_LEAD_TIME_THRESHOLDS_MINUTES,
  classifyConjunctionLeadTime,
  conjunctionsWithinMinutes,
  countConjunctionsByLeadTime,
  leadTimeMinutes
} from "../conjunctionLeadTime";

const now = new Date("2026-08-11T12:00:00Z");
const inMinutes = (minutes: number): Date => new Date(now.getTime() + minutes * 60_000);

const makeConjunction = (overrides: Partial<ConjunctionWarning> = {}): ConjunctionWarning => ({
  id: "c1",
  object1: { noradId: 1, name: "SAT-A" },
  object2: { noradId: 2, name: "SAT-B" },
  tca: inMinutes(30),
  missDistanceKm: 1,
  missDistanceM: 1000,
  pc: 1e-5,
  probability: 1e-5,
  relativeVelocityKms: 10,
  riskLevel: "watch",
  ...overrides
});

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

describe("countConjunctionsByLeadTime", () => {
  it("tallies conjunctions into lead-time buckets derived from TCA", () => {
    const conjunctions = [
      makeConjunction({ id: "a", tca: inMinutes(-10) }), // passed
      makeConjunction({ id: "b", tca: inMinutes(20) }), // imminent
      makeConjunction({ id: "c", tca: inMinutes(200) }), // soon
      makeConjunction({ id: "d", tca: inMinutes(800) }), // upcoming
      makeConjunction({ id: "e", tca: inMinutes(3000) }) // later
    ];
    expect(countConjunctionsByLeadTime(conjunctions, now)).toEqual({
      passed: 1,
      imminent: 1,
      soon: 1,
      upcoming: 1,
      later: 1
    });
  });

  it("returns zeroed buckets for an empty feed", () => {
    expect(countConjunctionsByLeadTime([], now)).toEqual({
      passed: 0,
      imminent: 0,
      soon: 0,
      upcoming: 0,
      later: 0
    });
  });

  it("accumulates multiple conjunctions in the same bucket", () => {
    const conjunctions = [
      makeConjunction({ id: "a", tca: inMinutes(5) }),
      makeConjunction({ id: "b", tca: inMinutes(45) })
    ];
    expect(countConjunctionsByLeadTime(conjunctions, now).imminent).toBe(2);
  });
});

describe("conjunctionsWithinMinutes", () => {
  it("keeps only conjunctions inside the upcoming window", () => {
    const conjunctions = [
      makeConjunction({ id: "past", tca: inMinutes(-5) }),
      makeConjunction({ id: "near", tca: inMinutes(30) }),
      makeConjunction({ id: "far", tca: inMinutes(120) })
    ];
    const ids = conjunctionsWithinMinutes(conjunctions, 60, now).map((c) => c.id);
    expect(ids).toEqual(["near"]);
  });

  it("treats the window's upper edge as inclusive", () => {
    const conjunctions = [makeConjunction({ id: "edge", tca: inMinutes(60) })];
    expect(conjunctionsWithinMinutes(conjunctions, 60, now)).toHaveLength(1);
  });

  it("excludes conjunctions whose TCA has just passed", () => {
    const conjunctions = [makeConjunction({ id: "passed", tca: inMinutes(-0.5) })];
    expect(conjunctionsWithinMinutes(conjunctions, 60, now)).toEqual([]);
  });

  it("preserves the original ordering and does not mutate the input", () => {
    const conjunctions = [
      makeConjunction({ id: "b", tca: inMinutes(40) }),
      makeConjunction({ id: "a", tca: inMinutes(10) })
    ];
    const snapshot = [...conjunctions];
    const ids = conjunctionsWithinMinutes(conjunctions, 60, now).map((c) => c.id);
    expect(ids).toEqual(["b", "a"]);
    expect(conjunctions).toEqual(snapshot);
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
