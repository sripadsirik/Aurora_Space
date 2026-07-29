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
