import type { OrbitType, RiskLevel, Satellite } from "../types/space";

/** The orbit regimes reported in catalog breakdowns, in ascending-altitude order. */
export const ORBIT_TYPES: readonly OrbitType[] = ["LEO", "MEO", "GEO"] as const;

/** Risk levels reported in catalog breakdowns, in ascending-severity order. */
export const RISK_LEVELS: readonly RiskLevel[] = ["nominal", "watch", "warning", "critical"] as const;

/**
 * Counts how many satellites fall in each orbit regime. Every regime in
 * {@link ORBIT_TYPES} is present in the result, defaulting to zero, so callers
 * can render a stable set of rows regardless of the catalog contents.
 */
export const countByOrbitType = (satellites: Satellite[]): Record<OrbitType, number> => {
  const counts: Record<OrbitType, number> = { LEO: 0, MEO: 0, GEO: 0 };
  for (const satellite of satellites) {
    counts[satellite.orbitType] += 1;
  }
  return counts;
};

/**
 * Counts how many satellites carry each risk level. Every level in
 * {@link RISK_LEVELS} is present in the result, defaulting to zero, so callers
 * can render a stable set of rows regardless of the catalog contents.
 */
export const countByRiskLevel = (satellites: Satellite[]): Record<RiskLevel, number> => {
  const counts: Record<RiskLevel, number> = { nominal: 0, watch: 0, warning: 0, critical: 0 };
  for (const satellite of satellites) {
    counts[satellite.riskLevel] += 1;
  }
  return counts;
};

/**
 * Mean altitude of the catalog in kilometres. Returns 0 for an empty catalog so
 * the figure is always a finite number rather than `NaN`.
 */
export const averageAltitudeKm = (satellites: Satellite[]): number => {
  if (satellites.length === 0) return 0;
  const total = satellites.reduce((sum, satellite) => sum + satellite.altitudeKm, 0);
  return total / satellites.length;
};

/**
 * Mean orbital velocity of the catalog in kilometres per second. Returns 0 for
 * an empty catalog so the figure is always a finite number rather than `NaN`.
 */
export const averageVelocityKms = (satellites: Satellite[]): number => {
  if (satellites.length === 0) return 0;
  const total = satellites.reduce((sum, satellite) => sum + satellite.velocityKms, 0);
  return total / satellites.length;
};

/**
 * Sum of every satellite's active conjunction count across the catalog. This is
 * a per-object tally, so a single conjunction shared by two catalogued objects
 * contributes to both and is counted twice.
 */
export const totalConjunctions = (satellites: Satellite[]): number =>
  satellites.reduce((sum, satellite) => sum + satellite.conjunctionCount, 0);

/**
 * Counts satellites whose risk level is at or above `threshold` in the
 * ascending-severity order of {@link RISK_LEVELS}. With the default `"watch"`
 * threshold this yields the count of objects flagged above nominal.
 */
export const countElevatedRisk = (
  satellites: Satellite[],
  threshold: RiskLevel = "watch"
): number => {
  const floor = RISK_LEVELS.indexOf(threshold);
  return satellites.reduce(
    (count, satellite) => (RISK_LEVELS.indexOf(satellite.riskLevel) >= floor ? count + 1 : count),
    0
  );
};

/** Aggregate view of a satellite catalog, suitable for a HUD or summary panel. */
export interface CatalogSummary {
  /** Total number of tracked objects. */
  total: number;
  /** Object counts keyed by orbit regime. */
  byOrbitType: Record<OrbitType, number>;
  /** Object counts keyed by risk level. */
  byRiskLevel: Record<RiskLevel, number>;
  /** Mean altitude in kilometres. */
  averageAltitudeKm: number;
  /** Mean orbital velocity in kilometres per second. */
  averageVelocityKms: number;
  /** Sum of per-object active conjunction counts. */
  totalConjunctions: number;
  /** Objects flagged at or above the `watch` risk level. */
  elevatedRisk: number;
}

/**
 * Bundles the catalog aggregates into a single struct so a summary display can
 * derive every figure from one pass over the same list. All members reuse the
 * individual helpers in this module, so they stay mutually consistent.
 */
export const summarizeCatalog = (satellites: Satellite[]): CatalogSummary => ({
  total: satellites.length,
  byOrbitType: countByOrbitType(satellites),
  byRiskLevel: countByRiskLevel(satellites),
  averageAltitudeKm: averageAltitudeKm(satellites),
  averageVelocityKms: averageVelocityKms(satellites),
  totalConjunctions: totalConjunctions(satellites),
  elevatedRisk: countElevatedRisk(satellites)
});
