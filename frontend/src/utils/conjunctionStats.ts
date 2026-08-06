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
 * Returns the conjunction with the smallest miss distance, or `null` for an
 * empty feed. Ties resolve to the earliest matching entry, so the result is
 * stable for a given ordering. The input is not mutated.
 */
export const closestApproach = (
  conjunctions: readonly ConjunctionWarning[]
): ConjunctionWarning | null =>
  conjunctions.reduce<ConjunctionWarning | null>(
    (closest, conjunction) =>
      closest === null || conjunction.missDistanceM < closest.missDistanceM ? conjunction : closest,
    null
  );

/**
 * Returns the conjunction with the earliest time of closest approach (TCA), or
 * `null` for an empty feed. Ties resolve to the earliest matching entry. The
 * input is not mutated.
 */
export const soonestTca = (
  conjunctions: readonly ConjunctionWarning[]
): ConjunctionWarning | null =>
  conjunctions.reduce<ConjunctionWarning | null>(
    (soonest, conjunction) =>
      soonest === null || conjunction.tca.getTime() < soonest.tca.getTime() ? conjunction : soonest,
    null
  );

/**
 * Returns the conjunction with the highest collision probability — the single
 * most severe event in the feed — or `null` when the feed is empty. Ties
 * resolve to the earliest matching entry. The input is not mutated.
 */
export const highestProbabilityConjunction = (
  conjunctions: readonly ConjunctionWarning[]
): ConjunctionWarning | null =>
  conjunctions.reduce<ConjunctionWarning | null>(
    (highest, conjunction) =>
      highest === null || conjunction.probability > highest.probability ? conjunction : highest,
    null
  );

/**
 * Mean miss distance across the feed in kilometres. Returns 0 for an empty feed
 * so the figure is always a finite number rather than `NaN`.
 */
export const averageMissDistanceKm = (conjunctions: readonly ConjunctionWarning[]): number => {
  if (conjunctions.length === 0) return 0;
  const total = conjunctions.reduce((sum, conjunction) => sum + conjunction.missDistanceKm, 0);
  return total / conjunctions.length;
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
