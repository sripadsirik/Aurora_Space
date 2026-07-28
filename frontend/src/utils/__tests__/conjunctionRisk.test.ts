import { describe, expect, it } from "vitest";
import {
  CONJUNCTION_RISK_THRESHOLDS,
  classifyConjunctionRisk,
  isActionableConjunctionRisk
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
