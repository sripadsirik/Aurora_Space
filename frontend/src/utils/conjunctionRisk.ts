import type { RiskLevel } from "../types/space";

/**
 * Collision-probability thresholds that separate the conjunction risk tiers.
 * A probability strictly greater than a threshold falls into that tier, so the
 * ordering is `critical` (≥ 1e-3) → `warning` (≥ 1e-4) → `watch` (≥ 1e-6) →
 * `nominal`. These are the canonical cut-offs shared by the globe overlays and
 * every conjunction panel.
 */
export const CONJUNCTION_RISK_THRESHOLDS = {
  critical: 1e-3,
  warning: 1e-4,
  watch: 1e-6
} as const;

/**
 * Classifies a raw collision probability into a {@link RiskLevel}. Probabilities
 * at or below the `watch` threshold are treated as `nominal`.
 */
export const classifyConjunctionRisk = (probability: number): RiskLevel => {
  if (probability > CONJUNCTION_RISK_THRESHOLDS.critical) return "critical";
  if (probability > CONJUNCTION_RISK_THRESHOLDS.warning) return "warning";
  if (probability > CONJUNCTION_RISK_THRESHOLDS.watch) return "watch";
  return "nominal";
};

/**
 * True when a probability is severe enough to warrant operator action — that is,
 * it lands in the `warning` or `critical` tier. Used to raise ops warning
 * indicators without re-deriving the thresholds at each call site.
 */
export const isActionableConjunctionRisk = (probability: number): boolean =>
  probability > CONJUNCTION_RISK_THRESHOLDS.warning;
