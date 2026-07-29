import type { OrbitType, RiskLevel, Satellite } from "../types/space";

/** The orbit regimes reported in catalog breakdowns, in ascending-altitude order. */
export const ORBIT_TYPES: readonly OrbitType[] = ["LEO", "MEO", "GEO"] as const;

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
