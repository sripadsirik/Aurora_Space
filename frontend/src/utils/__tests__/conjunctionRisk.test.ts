import { describe, expect, it } from "vitest";
import type { ConjunctionWarning } from "../../types/space";
import {
  CONJUNCTION_RISK_THRESHOLDS,
  MISS_DISTANCE_THRESHOLDS,
  classifyConjunctionFleetSeverity,
  classifyConjunctionRisk,
  classifyMissDistanceSeverity,
  conjunctionRiskTextClass,
  estimateManeuverDeltaVMs,
  isActionableConjunctionRisk,
  missDistanceSeverityTextClass,
  resolveConjunctionRiskLevel,
  sortConjunctionsByProbabilityDesc
} from "../conjunctionRisk";

const makeConjunction = (overrides: Partial<ConjunctionWarning> = {}): ConjunctionWarning => ({
  id: "c-1",
  object1: { noradId: 1, name: "A" },
  object2: { noradId: 2, name: "B" },
  tca: new Date("2026-01-01T00:00:00Z"),
  missDistanceKm: 5,
  missDistanceM: 5000,
  pc: 1e-6,
  probability: 1e-6,
  relativeVelocityKms: 7,
  riskLevel: "nominal",
  ...overrides
});

describe("classifyConjunctionRisk", () => {
  it("classifies probabilities above the critical threshold as critical", () => {
    expect(classifyConjunctionRisk(0.01)).toBe("critical");
    expect(classifyConjunctionRisk(CONJUNCTION_RISK_THRESHOLDS.critical * 1.1)).toBe("critical");
  });

  it("classifies probabilities in the warning band as warning", () => {
    expect(classifyConjunctionRisk(5e-4)).toBe("warning");
    expect(classifyConjunctionRisk(CONJUNCTION_RISK_THRESHOLDS.warning * 1.1)).toBe("warning");
  });

  it("classifies probabilities in the watch band as watch", () => {
    expect(classifyConjunctionRisk(5e-6)).toBe("watch");
    expect(classifyConjunctionRisk(CONJUNCTION_RISK_THRESHOLDS.watch * 1.1)).toBe("watch");
  });

  it("classifies low and zero probabilities as nominal", () => {
    expect(classifyConjunctionRisk(1e-7)).toBe("nominal");
    expect(classifyConjunctionRisk(0)).toBe("nominal");
  });

  it("treats each threshold boundary as the lower, less-severe tier", () => {
    // Boundaries use strict `>`, so a value exactly on a threshold is NOT promoted.
    expect(classifyConjunctionRisk(CONJUNCTION_RISK_THRESHOLDS.critical)).toBe("warning");
    expect(classifyConjunctionRisk(CONJUNCTION_RISK_THRESHOLDS.warning)).toBe("watch");
    expect(classifyConjunctionRisk(CONJUNCTION_RISK_THRESHOLDS.watch)).toBe("nominal");
  });
});

describe("isActionableConjunctionRisk", () => {
  it("is true for warning and critical probabilities", () => {
    expect(isActionableConjunctionRisk(0.01)).toBe(true);
    expect(isActionableConjunctionRisk(5e-4)).toBe(true);
  });

  it("is false for watch, nominal, and boundary probabilities", () => {
    expect(isActionableConjunctionRisk(5e-6)).toBe(false);
    expect(isActionableConjunctionRisk(0)).toBe(false);
    expect(isActionableConjunctionRisk(CONJUNCTION_RISK_THRESHOLDS.warning)).toBe(false);
  });
});

describe("classifyConjunctionFleetSeverity", () => {
  it("is critical when any conjunction is individually critical", () => {
    const fleet = [
      makeConjunction({ id: "a", probability: 1e-6, missDistanceM: 5000 }),
      makeConjunction({ id: "b", probability: 0.006, missDistanceM: 5000 })
    ];
    expect(classifyConjunctionFleetSeverity(fleet)).toBe("critical");
  });

  it("is critical from a close miss distance even with a low probability", () => {
    const fleet = [makeConjunction({ probability: 1e-8, missDistanceM: 200 })];
    expect(classifyConjunctionFleetSeverity(fleet)).toBe("critical");
  });

  it("is warning when the most severe conjunction is actionable but not critical", () => {
    const fleet = [
      makeConjunction({ id: "a", probability: 1e-6, missDistanceM: 5000 }),
      makeConjunction({ id: "b", probability: 5e-4, missDistanceM: 5000 })
    ];
    expect(classifyConjunctionFleetSeverity(fleet)).toBe("warning");
  });

  it("is elevated when conjunctions are tracked but none are actionable", () => {
    const fleet = [
      makeConjunction({ id: "a", probability: 1e-6, missDistanceM: 5000 }),
      makeConjunction({ id: "b", probability: 5e-5, missDistanceM: 5000 })
    ];
    expect(classifyConjunctionFleetSeverity(fleet)).toBe("elevated");
  });

  it("is clear when the fleet is empty", () => {
    expect(classifyConjunctionFleetSeverity([])).toBe("clear");
  });
});

describe("sortConjunctionsByProbabilityDesc", () => {
  it("orders conjunctions from highest to lowest probability", () => {
    const input = [{ probability: 1e-5 }, { probability: 1e-2 }, { probability: 1e-4 }];
    expect(sortConjunctionsByProbabilityDesc(input).map((c) => c.probability)).toEqual([1e-2, 1e-4, 1e-5]);
  });

  it("does not mutate the input array", () => {
    const input = [{ probability: 1e-5 }, { probability: 1e-2 }];
    sortConjunctionsByProbabilityDesc(input);
    expect(input.map((c) => c.probability)).toEqual([1e-5, 1e-2]);
  });

  it("returns an empty array unchanged", () => {
    expect(sortConjunctionsByProbabilityDesc([])).toEqual([]);
  });
});

describe("conjunctionRiskTextClass", () => {
  it("uses the shared critical colour regardless of the default", () => {
    expect(conjunctionRiskTextClass("critical", "text-white")).toBe("text-[#ff7d7d]");
  });

  it("uses the shared warning colour regardless of the default", () => {
    expect(conjunctionRiskTextClass("warning", "text-[#d8ebff]")).toBe("text-[#ffcd73]");
  });

  it("falls back to the caller-supplied default for watch", () => {
    expect(conjunctionRiskTextClass("watch", "text-[#d8ebff]")).toBe("text-[#d8ebff]");
  });

  it("falls back to the caller-supplied default for nominal", () => {
    expect(conjunctionRiskTextClass("nominal", "text-white")).toBe("text-white");
  });
});

describe("classifyMissDistanceSeverity", () => {
  it("classifies distances below the critical cut-off as critical", () => {
    expect(classifyMissDistanceSeverity(0)).toBe("critical");
    expect(classifyMissDistanceSeverity(MISS_DISTANCE_THRESHOLDS.critical - 1)).toBe("critical");
  });

  it("treats the critical cut-off itself as warning", () => {
    expect(classifyMissDistanceSeverity(MISS_DISTANCE_THRESHOLDS.critical)).toBe("warning");
  });

  it("classifies distances in the warning band as warning", () => {
    expect(classifyMissDistanceSeverity(MISS_DISTANCE_THRESHOLDS.warning - 1)).toBe("warning");
  });

  it("classifies the warning cut-off and beyond as nominal", () => {
    expect(classifyMissDistanceSeverity(MISS_DISTANCE_THRESHOLDS.warning)).toBe("nominal");
    expect(classifyMissDistanceSeverity(50000)).toBe("nominal");
  });
});

describe("missDistanceSeverityTextClass", () => {
  it("returns the critical colour for very close approaches", () => {
    expect(missDistanceSeverityTextClass(200)).toBe("text-[#ff7d7d]");
  });

  it("returns the warning colour in the warning band", () => {
    expect(missDistanceSeverityTextClass(700)).toBe("text-[#ffcd73]");
  });

  it("returns the clear colour once comfortably separated", () => {
    expect(missDistanceSeverityTextClass(5000)).toBe("text-[#7de6b1]");
  });
});

describe("estimateManeuverDeltaVMs", () => {
  it("scales linearly with collision probability", () => {
    expect(estimateManeuverDeltaVMs(0.01)).toBeCloseTo(100, 6);
    expect(estimateManeuverDeltaVMs(5e-4)).toBeCloseTo(5, 6);
  });

  it("returns zero for a zero probability", () => {
    expect(estimateManeuverDeltaVMs(0)).toBe(0);
  });

  it("clamps negative probabilities to zero", () => {
    expect(estimateManeuverDeltaVMs(-0.1)).toBe(0);
  });
});

describe("resolveConjunctionRiskLevel", () => {
  it("prefers an explicit riskLevel over the classified probability", () => {
    const conjunction = makeConjunction({ riskLevel: "critical", pc: 1e-9, probability: 1e-9 });
    expect(resolveConjunctionRiskLevel(conjunction)).toBe("critical");
  });

  it("classifies from pc when riskLevel is absent", () => {
    const conjunction = makeConjunction({ riskLevel: undefined as never, pc: 0.01, probability: 1e-9 });
    expect(resolveConjunctionRiskLevel(conjunction)).toBe("critical");
  });

  it("falls back to probability when pc is absent", () => {
    const conjunction = makeConjunction({ riskLevel: undefined as never, pc: undefined as never, probability: 5e-4 });
    expect(resolveConjunctionRiskLevel(conjunction)).toBe("warning");
  });

  it("resolves to nominal for a quiet conjunction with no explicit level", () => {
    const conjunction = makeConjunction({ riskLevel: undefined as never, pc: 1e-9, probability: 1e-9 });
    expect(resolveConjunctionRiskLevel(conjunction)).toBe("nominal");
  });
});
