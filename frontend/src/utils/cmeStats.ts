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
