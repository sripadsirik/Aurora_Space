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

/**
 * Mean forecast confidence across the feed, as a percentage. Returns 0 for an
 * empty feed so the figure is always a finite number rather than `NaN`.
 */
export const averageConfidence = (cmes: readonly MockCME[]): number => {
  if (cmes.length === 0) return 0;
  const total = cmes.reduce((sum, cme) => sum + cme.confidence, 0);
  return total / cmes.length;
};

/** Aggregate view of a CME library, suitable for a HUD or panel header. */
export interface CmeLibrarySummary {
  /** Total number of tracked CMEs, including clean misses. */
  total: number;
  /** CMEs modelled to reach Earth (direct hits and glancing blows). */
  impacting: number;
  /** The soonest inbound CME, or `null` when nothing is inbound. */
  next: MockCME | null;
  /** The highest-speed ejection in the feed, or `null` for an empty feed. */
  fastest: MockCME | null;
  /** Highest predicted Kp across the feed. */
  peakKp: number;
  /** Mean forecast confidence as a percentage. */
  averageConfidence: number;
}

/**
 * Bundles the CME aggregates into a single struct so a summary display can derive
 * every figure from one list. All members reuse the individual helpers in this
 * module, so they stay mutually consistent.
 */
export const summarizeCmeLibrary = (cmes: readonly MockCME[]): CmeLibrarySummary => ({
  total: cmes.length,
  impacting: countImpactingCmes(cmes),
  next: nextArrival(cmes),
  fastest: fastestCme(cmes),
  peakKp: peakPredictedKp(cmes),
  averageConfidence: averageConfidence(cmes)
});
