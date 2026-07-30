import { CONJUNCTION_RISK_THRESHOLDS } from "./conjunctionRisk";

// The gauge spans the same probabilities as the conjunction risk tiers: the
// `watch` threshold is the floor (gauge 0) and the `critical` threshold is the
// ceiling (gauge 1), so the gauge and the tier boundaries can never drift apart.
const GAUGE_FLOOR_EXP = Math.log10(CONJUNCTION_RISK_THRESHOLDS.watch);
const GAUGE_CEIL_EXP = Math.log10(CONJUNCTION_RISK_THRESHOLDS.critical);

/**
 * Normalises a collision probability onto a `0-1` gauge scale using a base-10
 * log mapping: `1e-6` maps to 0 (gauge floor) and `1e-3` maps to 1 (gauge
 * ceiling), with values in between interpolated linearly in log space. A
 * non-positive probability returns 0, and the result is clamped to `[0, 1]`.
 */
export const normalizeProbability = (probability: number): number => {
  if (probability <= 0) {
    return 0;
  }

  const normalized = (Math.log10(probability) - GAUGE_FLOOR_EXP) / (GAUGE_CEIL_EXP - GAUGE_FLOOR_EXP);
  return Math.max(0, Math.min(1, normalized));
};
