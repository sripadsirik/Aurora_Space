import type { ConjunctionWarning, RiskLevel } from "../types/space";
import { RISK_LEVELS } from "./catalogStats";
import { classifyConjunctionRisk, isActionableConjunctionRisk } from "./conjunctionRisk";

/**
 * Counts how many conjunctions fall in each risk tier, deriving the tier from
 * each warning's collision probability via {@link classifyConjunctionRisk}.
 * Every level in {@link RISK_LEVELS} is present in the result, defaulting to
 * zero, so a summary display can render a stable set of rows regardless of the
 * feed contents.
 */
export const countConjunctionsByRisk = (
  conjunctions: readonly ConjunctionWarning[]
): Record<RiskLevel, number> => {
  const counts: Record<RiskLevel, number> = { nominal: 0, watch: 0, warning: 0, critical: 0 };
  for (const conjunction of conjunctions) {
    counts[classifyConjunctionRisk(conjunction.probability)] += 1;
  }
  return counts;
};

/**
 * Counts conjunctions severe enough to warrant operator action — those whose
 * collision probability lands in the `warning` or `critical` tier per
 * {@link isActionableConjunctionRisk}.
 */
export const countActionableConjunctions = (
  conjunctions: readonly ConjunctionWarning[]
): number =>
  conjunctions.reduce(
    (count, conjunction) => (isActionableConjunctionRisk(conjunction.probability) ? count + 1 : count),
    0
  );
