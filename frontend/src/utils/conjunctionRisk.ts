import type { ConjunctionWarning, RiskLevel } from "../types/space";
import { isCriticalConjunction } from "./format";

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

/**
 * Miss-distance cut-offs (in metres) that separate a conjunction's proximity
 * severity. A distance strictly below `critical` is `critical`; below `warning`
 * is `warning`; anything else is `nominal`. These mirror the collision-probability
 * tiers but key off physical separation, and are shared by the detail and list
 * panels so the colour thresholds are defined once.
 */
export const MISS_DISTANCE_THRESHOLDS = {
  critical: 500,
  warning: 1000
} as const;

/** Proximity severity derived purely from a conjunction's miss distance. */
export type MissDistanceSeverity = "critical" | "warning" | "nominal";

/**
 * Classifies a miss distance (in metres) into a {@link MissDistanceSeverity}
 * using {@link MISS_DISTANCE_THRESHOLDS}.
 */
export const classifyMissDistanceSeverity = (meters: number): MissDistanceSeverity => {
  if (meters < MISS_DISTANCE_THRESHOLDS.critical) return "critical";
  if (meters < MISS_DISTANCE_THRESHOLDS.warning) return "warning";
  return "nominal";
};

/**
 * Maps a conjunction {@link RiskLevel} to the Tailwind text-colour class used by
 * the conjunction tables. `critical` and `warning` have fixed colours shared by
 * every panel; the class for the calmer `watch`/`nominal` tiers is supplied by
 * the caller via `defaultClass`, since panels differ on their resting colour.
 */
export const conjunctionRiskTextClass = (risk: RiskLevel, defaultClass: string): string => {
  if (risk === "critical") return "text-[#ff7d7d]";
  if (risk === "warning") return "text-[#ffcd73]";
  return defaultClass;
};

/**
 * Maps a miss distance (in metres) to the Tailwind text-colour class used for
 * the distance figure in the conjunction panels: red when critically close,
 * amber in the warning band, and green once comfortably clear. Centralises the
 * colour ramp that the detail panel previously derived inline.
 */
export const missDistanceSeverityTextClass = (meters: number): string => {
  const severity = classifyMissDistanceSeverity(meters);
  if (severity === "critical") return "text-[#ff7d7d]";
  if (severity === "warning") return "text-[#ffcd73]";
  return "text-[#7de6b1]";
};

/**
 * Fleet-level severity for a collection of active conjunctions, ordered from
 * least to most urgent: `clear` (nothing tracked), `elevated` (conjunctions
 * present but none actionable), `warning`, and `critical`.
 */
export type ConjunctionFleetSeverity = "critical" | "warning" | "elevated" | "clear";

/**
 * Collapses a fleet of conjunctions into a single {@link ConjunctionFleetSeverity}
 * describing its most urgent member. A fleet is `critical` when any conjunction
 * is individually critical (see {@link isCriticalConjunction}), `warning` when
 * any remaining conjunction is actionable by probability, `elevated` when
 * conjunctions are tracked but none reach those tiers, and `clear` when the
 * fleet is empty. This centralises the badge/overlay escalation logic so call
 * sites do not re-derive it from raw thresholds.
 */
export const classifyConjunctionFleetSeverity = (
  conjunctions: readonly ConjunctionWarning[]
): ConjunctionFleetSeverity => {
  if (conjunctions.length === 0) return "clear";
  if (conjunctions.some(isCriticalConjunction)) return "critical";
  if (conjunctions.some((c) => isActionableConjunctionRisk(c.probability))) return "warning";
  return "elevated";
};

/**
 * Returns a new array of conjunctions ordered most-to-least severe by collision
 * probability. The input is not mutated, so it is safe to call on store state.
 */
export const sortConjunctionsByProbabilityDesc = <T extends Pick<ConjunctionWarning, "probability">>(
  conjunctions: readonly T[]
): T[] => [...conjunctions].sort((a, b) => b.probability - a.probability);
