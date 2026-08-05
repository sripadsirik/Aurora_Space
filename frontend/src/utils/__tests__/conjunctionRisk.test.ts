import { describe, expect, it } from "vitest";
import {
  CONJUNCTION_RISK_THRESHOLDS,
  classifyConjunctionRisk,
  conjunctionRiskTextClass,
  isActionableConjunctionRisk,
  sortConjunctionsByProbabilityDesc
} from "../conjunctionRisk";

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
