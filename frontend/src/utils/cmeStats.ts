import type { MockCME } from "../types/space";

/**
 * Whether a coronal mass ejection is modelled to reach Earth at all. Every CME
 * except a clean miss (`impactStatus` of `"NO IMPACT — MISS"`) counts as
 * impacting, covering both direct hits and glancing blows.
 */
export const isImpactingCme = (cme: Pick<MockCME, "impactStatus">): boolean =>
  cme.impactStatus !== "NO IMPACT — MISS";
