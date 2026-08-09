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
