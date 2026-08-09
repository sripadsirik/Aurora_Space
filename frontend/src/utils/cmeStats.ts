import type { MockCME } from "../types/space";

/**
 * Whether a coronal mass ejection is modelled to reach Earth at all. Every CME
 * except a clean miss (`impactStatus` of `"NO IMPACT — MISS"`) counts as
 * impacting, covering both direct hits and glancing blows.
 */
export const isImpactingCme = (cme: Pick<MockCME, "impactStatus">): boolean =>
  cme.impactStatus !== "NO IMPACT — MISS";

/**
 * Counts how many CMEs in the feed are modelled to reach Earth, per
 * {@link isImpactingCme}. Clean misses are excluded, so the figure reflects the
 * number of ejections an operator actually needs to track.
 */
export const countImpactingCmes = (cmes: readonly MockCME[]): number =>
  cmes.reduce((count, cme) => (isImpactingCme(cme) ? count + 1 : count), 0);

/**
 * Whether a CME is still inbound: it is modelled to reach Earth
 * ({@link isImpactingCme}) and its arrival is in the future
 * (`hoursUntilArrival > 0`). Already-arrived ejections and clean misses are
 * excluded, matching the set an operator would count down to.
 */
export const isPendingCme = (
  cme: Pick<MockCME, "impactStatus" | "hoursUntilArrival">
): boolean => isImpactingCme(cme) && cme.hoursUntilArrival > 0;

/**
 * Returns the inbound CME due to reach Earth soonest — the smallest positive
 * `hoursUntilArrival` among the pending ejections ({@link isPendingCme}) — or
 * `null` when nothing is inbound. Ties resolve to the earliest matching entry,
 * so the result is stable for a given ordering. The input is not mutated.
 */
export const nextArrival = (cmes: readonly MockCME[]): MockCME | null =>
  cmes.reduce<MockCME | null>(
    (soonest, cme) =>
      isPendingCme(cme) && (soonest === null || cme.hoursUntilArrival < soonest.hoursUntilArrival)
        ? cme
        : soonest,
    null
  );

/**
 * Returns the CME with the highest modelled plasma speed, or `null` for an empty
 * feed. Speed is a physical property of the ejection, so misses are considered
 * alongside impacts. Ties resolve to the earliest matching entry; the input is
 * not mutated.
 */
export const fastestCme = (cmes: readonly MockCME[]): MockCME | null =>
  cmes.reduce<MockCME | null>(
    (fastest, cme) => (fastest === null || cme.speed > fastest.speed ? cme : fastest),
    null
  );

/**
 * Highest predicted Kp across the feed — the peak geomagnetic response any of the
 * ejections is forecast to drive. Returns 0 for an empty feed so the figure is
 * always a finite number. Clean misses forecast a Kp of 0 and so do not inflate
 * the peak.
 */
export const peakPredictedKp = (cmes: readonly MockCME[]): number =>
  cmes.reduce((peak, cme) => Math.max(peak, cme.predictedKp), 0);
